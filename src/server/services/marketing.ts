import { db } from '@/lib/db/client';
import { withPortal, type PortalScope } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { badRequest } from '@/lib/errors';
import { m, sum, type Decimal } from '@/domain/finance/money';
import {
  NO_SOURCE,
  NO_SOURCE_NAME,
  averageCycleDays,
  channelReport,
  isQualified,
  planFact,
  reversePlan,
  salesBreakdown,
  salesRow,
  type ChannelMetrics,
  type CrmElement,
  type PlanFactRow,
  type SalesRow,
} from '@/domain/finance/marketing';
import { dayKey, zonedParts, type AnalyticsPeriod } from '@/domain/analytics';
import {
  crmElementUrl,
  fetchElements,
  fetchSources,
  fetchStages,
  firstStages,
  type StageInfo,
} from '@/lib/bitrix/marketing';
import { DEMO_SOURCES, DEMO_STAGES, demoElements } from '@/lib/demo/marketing-demo';
import type { ResolvedSession } from '@/lib/auth/resolve';
import { listCrmSections } from './portal-setup';
import type { CreateSpendInput, SavePlanInput } from '@/server/dto/marketing';
import { stageSemantic } from '@/domain/crm/stages';
import { loadStageRules } from './stage-rules';

/**
 * Marketing and sales by channel (ADR-048). Leads come from the CRM sections marked as
 * traffic, sales from the ones marked as sales (ADR-041); the channel is the element's
 * source. Spend and plan are entered here by hand.
 */

// ─── Loading from Bitrix24 ───────────────────────────────────────────────────

export interface MarketingData {
  sources: Record<string, string>;
  /** Traffic elements created in the period. */
  leads: CrmElement[];
  /** Sales elements created in the period. */
  created: CrmElement[];
  /** Sales elements won with a close date in the period. */
  won: CrmElement[];
  /** Stages of the traffic funnels, for «what counts as qualified». */
  leadStages: Record<string, StageInfo>;
  /** Every stage seen, traffic and sales, for stage names in the lists. */
  stages: Record<string, StageInfo>;
  /** Section title by entityTypeId. */
  sections: Record<number, string>;
  truncated: boolean;
  errors: string[];
  fetchedAt: Date;
}

const TTL_MS = 10 * 60_000;
const globalForCache = globalThis as unknown as { __marketing?: Map<string, MarketingData> };
const cache = (globalForCache.__marketing ??= new Map());

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function loadMarketingData(
  session: ResolvedSession,
  scope: PortalScope,
  period: Pick<AnalyticsPeriod, 'start' | 'end'>,
  tz: string,
  opts: { refresh?: boolean } = {},
): Promise<MarketingData> {
  const now = new Date();
  if (session.demo) {
    const users = await scope.user.findMany();
    const managers = users.filter((u) => u.role !== 'EMPLOYEE').map((u) => u.bitrixUserId);
    // Deals created up to two months before the period can still close inside it.
    const { leads, deals } = demoElements(
      new Date(period.start.getTime() - 62 * 86_400_000),
      period.end,
      now,
      managers,
    );
    const inPeriod = (d: Date | null) => d !== null && d >= period.start && d < period.end;
    return {
      sources: DEMO_SOURCES,
      leads: leads.filter((l) => inPeriod(l.createdAt)),
      created: deals.filter((d) => inPeriod(d.createdAt)),
      won: deals.filter((d) => d.semantic === 'success' && inPeriod(d.closedAt)),
      leadStages: Object.fromEntries(
        Object.entries(DEMO_STAGES).filter(([, s]) => s.funnel === 'STATUS'),
      ),
      stages: DEMO_STAGES,
      sections: { 1: 'Лиды', 2: 'Сделки' },
      truncated: false,
      errors: [],
      fetchedAt: now,
    };
  }

  const key = `${session.portal.id}:${period.start.toISOString()}:${period.end.toISOString()}:${session.portal.setupCompletedAt?.getTime() ?? 0}`;
  const hit = cache.get(key);
  if (hit && !opts.refresh && now.getTime() - hit.fetchedAt.getTime() < TTL_MS) return hit;

  const data: MarketingData = {
    sources: {},
    leads: [],
    created: [],
    won: [],
    leadStages: {},
    stages: {},
    sections: {},
    truncated: false,
    errors: [],
    fetchedAt: now,
  };
  const portal = session.portal;
  const created = {
    '>=createdTime': period.start.toISOString(),
    '<createdTime': period.end.toISOString(),
  };
  const closed = { '>=closedate': dayKey(period.start, tz), '<closedate': dayKey(period.end, tz) };

  let sections: Awaited<ReturnType<typeof listCrmSections>> = [];
  try {
    sections = await listCrmSections(portal, scope);
    data.sections = Object.fromEntries(sections.map((s) => [s.entityTypeId, s.title]));
  } catch (err) {
    data.errors.push(`Разделы CRM: ${message(err)}`);
  }
  try {
    data.sources = await fetchSources(portal);
  } catch (err) {
    data.errors.push(`Источники: ${message(err)}`);
  }

  // The portal's own reading of stages (ADR-051) wins over Bitrix24's semantics.
  const rules = await loadStageRules(scope);
  const ruled = (items: CrmElement[]) =>
    items.map((i) =>
      i.stageId ? { ...i, semantic: stageSemantic(rules, i.entityTypeId, i.stageId, i.semantic) } : i,
    );

  const funnels = new Set<string>(['STATUS']);
  for (const s of sections.filter((x) => x.role === 'TRAFFIC')) {
    try {
      const r = await fetchElements(portal, s.entityTypeId, created);
      data.leads.push(...ruled(r.items));
      data.truncated ||= r.truncated;
      for (const st of Object.values(r.stages)) funnels.add(st.funnel);
    } catch (err) {
      data.errors.push(`${s.title}: ${message(err)}`);
    }
  }
  for (const s of sections.filter((x) => x.role === 'SALES')) {
    try {
      const [c, w] = await Promise.all([
        fetchElements(portal, s.entityTypeId, created),
        fetchElements(portal, s.entityTypeId, closed),
      ]);
      data.created.push(...ruled(c.items));
      data.won.push(...ruled(w.items).filter((i) => i.semantic === 'success'));
      Object.assign(data.stages, c.stages, w.stages);
      data.truncated ||= c.truncated || w.truncated;
    } catch (err) {
      data.errors.push(`${s.title}: ${message(err)}`);
    }
  }
  try {
    data.leadStages = await fetchStages(portal, [...funnels]);
    Object.assign(data.stages, data.leadStages);
  } catch (err) {
    data.errors.push(`Стадии лидов: ${message(err)}`);
  }

  cache.set(key, data);
  return data;
}

/** Drops cached Bitrix24 reads of a portal (after settings change what counts). */
export function invalidateMarketing(portalId: string): void {
  for (const k of cache.keys()) if (k.startsWith(`${portalId}:`)) cache.delete(k);
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

const money = (d: Decimal | null) => (d === null ? null : d.toFixed(2));
const pct = (d: Decimal | null) => (d === null ? null : d.toFixed(1));

export interface ChannelMetricsDto {
  spent: string;
  paid: string;
  leads: number;
  qualified: number;
  sales: number;
  revenue: string;
  cpl: string | null;
  cpl2: string | null;
  cac: string | null;
  leadToQualified: string | null;
  qualifiedToSale: string | null;
  leadToSale: string | null;
  avgCheck: string | null;
  romi: string | null;
}

export interface ChannelRowDto extends ChannelMetricsDto {
  sourceId: string;
  name: string;
}

function metricsDto(c: ChannelMetrics): ChannelMetricsDto {
  return {
    spent: c.spent.toFixed(2),
    paid: c.paid.toFixed(2),
    leads: c.leads,
    qualified: c.qualified,
    sales: c.sales,
    revenue: c.revenue.toFixed(2),
    cpl: money(c.cpl),
    cpl2: money(c.cpl2),
    cac: money(c.cac),
    leadToQualified: pct(c.leadToQualified),
    qualifiedToSale: pct(c.qualifiedToSale),
    leadToSale: pct(c.leadToSale),
    avgCheck: money(c.avgCheck),
    romi: pct(c.romi),
  };
}

export interface PlanFactRowDto {
  key: PlanFactRow['key'];
  label: string;
  money: boolean;
  plan: string | null;
  fact: string;
  done: string | null;
  forecast: string;
}

const PLAN_LABEL: Record<PlanFactRow['key'], string> = {
  budget: 'Бюджет',
  leads: 'Лиды',
  qualified: 'Квал. лиды',
  sales: 'Продажи',
};

export interface SpendDto {
  id: string;
  sourceId: string;
  channel: string;
  date: string;
  kind: 'SPENT' | 'PAID';
  amount: string;
  note: string | null;
}

export interface PlanDto {
  sourceId: string;
  budget: string | null;
  leads: number | null;
  qualifiedLeads: number | null;
  sales: number | null;
}

export interface MarketingReport {
  channels: ChannelRowDto[];
  total: ChannelMetricsDto;
  /** The month whose plan is shown and edited: the selected month, or the current one. */
  planMonth: string;
  /** For a month period: plan against fact, with the forecast for the month. */
  planFact: PlanFactRowDto[] | null;
  plans: PlanDto[];
  /** «Обратный план» from the month's sales target at the period's rates. */
  reverse: {
    sales: number;
    qualified: number | null;
    leads: number | null;
    budget: string | null;
  } | null;
  spends: SpendDto[];
  sourceOptions: Array<{ id: string; name: string }>;
  stageOptions: Array<{ id: string; name: string; semantic: string; qualifiedByDefault: boolean }>;
  qualifiedStages: string[];
  truncated: boolean;
  errors: string[];
  fetchedAt: string;
}

function sourceName(sources: Record<string, string>, id: string): string {
  return id === NO_SOURCE ? NO_SOURCE_NAME : (sources[id] ?? id);
}

/** Days of `month` passed by `now` (all of them for a past month, none for a future one). */
function monthProgress(month: string, now: Date, tz: string): { elapsed: number; total: number } {
  const [y, mo] = month.split('-').map(Number) as [number, number];
  const total = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const t = zonedParts(now, tz);
  const cur = t.year * 12 + t.month;
  const sel = y * 12 + mo;
  if (sel < cur) return { elapsed: total, total };
  if (sel > cur) return { elapsed: 0, total };
  return { elapsed: t.day, total };
}

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function marketingReport(
  session: ResolvedSession,
  scope: PortalScope,
  period: AnalyticsPeriod,
  tz: string,
  opts: { refresh?: boolean } = {},
): Promise<MarketingReport> {
  const data = await loadMarketingData(session, scope, period, tz, opts);
  const nowParts = zonedParts(new Date(), tz);
  const planMonth = period.month ?? `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}`;
  const from = new Date(`${dayKey(period.start, tz)}T00:00:00Z`);
  const to = new Date(`${dayKey(period.end, tz)}T00:00:00Z`);
  const [spends, config, plans] = await Promise.all([
    scope.marketingSpend.findMany({ date: { gte: from, lt: to } }),
    scope.marketingConfig.get(),
    scope.marketingPlan.findMany({ month: planMonth }),
  ]);

  const picked = new Set(config?.qualifiedStages ?? []);
  const first = firstStages(data.leadStages);
  const leads = data.leads.map((l) => ({ ...l, qualified: isQualified(l, picked, first) }));
  const { rows, total } = channelReport({
    sourceNames: data.sources,
    leads,
    won: data.won,
    spends: spends.map((s) => ({
      sourceId: s.sourceId,
      kind: s.kind,
      amount: m(s.amount.toString()),
    })),
  });

  let pf: PlanFactRowDto[] | null = null;
  let reverse: MarketingReport['reverse'] = null;
  const overall = plans.find((p) => p.sourceId === '');
  if (period.month) {
    const { elapsed, total: days } = monthProgress(period.month, new Date(), tz);
    pf = planFact(
      {
        budget: overall?.budget ? m(overall.budget.toString()) : null,
        leads: overall?.leads ?? null,
        qualified: overall?.qualifiedLeads ?? null,
        sales: overall?.sales ?? null,
      },
      total,
      elapsed,
      days,
    ).map((r) => ({
      key: r.key,
      label: PLAN_LABEL[r.key],
      money: r.key === 'budget',
      plan: r.plan === null ? null : r.key === 'budget' ? r.plan.toFixed(2) : r.plan.toFixed(0),
      fact: r.key === 'budget' ? r.fact.toFixed(2) : r.fact.toFixed(0),
      done: pct(r.done),
      forecast: r.key === 'budget' ? r.forecast.toFixed(2) : r.forecast.toFixed(0),
    }));
    if (overall?.sales) {
      const r = reversePlan(overall.sales, total);
      reverse = {
        sales: overall.sales,
        qualified: r.qualified,
        leads: r.leads,
        budget: money(r.budget),
      };
    }
  }

  const sourceIds = new Set([...Object.keys(data.sources), ...rows.map((r) => r.sourceId)]);
  sourceIds.delete(NO_SOURCE);

  return {
    channels: rows.map((r) => ({ sourceId: r.sourceId, name: r.name, ...metricsDto(r) })),
    total: metricsDto(total),
    planMonth,
    planFact: pf,
    plans: plans.map((p) => ({
      sourceId: p.sourceId,
      budget: p.budget?.toFixed(2) ?? null,
      leads: p.leads,
      qualifiedLeads: p.qualifiedLeads,
      sales: p.sales,
    })),
    reverse,
    spends: spends.map((s) => ({
      id: s.id,
      sourceId: s.sourceId,
      channel: sourceName(data.sources, s.sourceId),
      date: toDay(s.date),
      kind: s.kind,
      amount: s.amount.toFixed(2),
      note: s.note,
    })),
    sourceOptions: [...sourceIds]
      .map((id) => ({ id, name: sourceName(data.sources, id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    stageOptions: Object.values(data.leadStages)
      .sort((a, b) => a.funnel.localeCompare(b.funnel) || a.sort - b.sort)
      .map((s) => ({
        id: s.id,
        name: s.name,
        semantic: s.semantic,
        qualifiedByDefault: isQualified({ stageId: s.id, semantic: s.semantic }, new Set(), first),
      })),
    qualifiedStages: [...picked],
    truncated: data.truncated,
    errors: data.errors,
    fetchedAt: data.fetchedAt.toISOString(),
  };
}

export interface SalesRowDto {
  key: string;
  name: string;
  created: number;
  inWork: number;
  won: number;
  lost: number;
  conversion: string | null;
  sales: number;
  revenue: string;
  avgCheck: string | null;
}

export interface SalesReport {
  total: SalesRowDto;
  cycleDays: number | null;
  byChannel: SalesRowDto[];
  byManager: SalesRowDto[];
  truncated: boolean;
  errors: string[];
  fetchedAt: string;
}

function salesDto(r: SalesRow): SalesRowDto {
  return {
    key: r.key,
    name: r.name,
    created: r.created,
    inWork: r.inWork,
    won: r.won,
    lost: r.lost,
    conversion: pct(r.conversion),
    sales: r.sales,
    revenue: r.revenue.toFixed(2),
    avgCheck: money(r.avgCheck),
  };
}

export async function salesReport(
  session: ResolvedSession,
  scope: PortalScope,
  period: AnalyticsPeriod,
  tz: string,
  opts: { refresh?: boolean } = {},
): Promise<SalesReport> {
  const [data, users] = await Promise.all([
    loadMarketingData(session, scope, period, tz, opts),
    scope.user.findMany(),
  ]);
  const people = new Map(users.map((u) => [u.bitrixUserId, `${u.firstName} ${u.lastName}`.trim()]));
  return {
    total: salesDto(salesRow('all', 'Всего', data.created, data.won)),
    cycleDays: averageCycleDays(data.won),
    byChannel: salesBreakdown(
      data.created,
      data.won,
      (e) => e.sourceId,
      (k) => sourceName(data.sources, k),
    ).map(salesDto),
    byManager: salesBreakdown(
      data.created,
      data.won,
      (e) => e.assignedById,
      (k) => (k === NO_SOURCE ? 'Без ответственного' : (people.get(k) ?? `Сотрудник ${k}`)),
    ).map(salesDto),
    truncated: data.truncated,
    errors: data.errors,
    fetchedAt: data.fetchedAt.toISOString(),
  };
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function actorOf(session: ResolvedSession) {
  return {
    appUserId: session.user.id,
    name: `${session.user.firstName} ${session.user.lastName}`.trim(),
  };
}

/** Records money put into a channel; audited like any finance entry. */
export async function createSpend(
  session: ResolvedSession,
  input: CreateSpendInput,
): Promise<{ id: string }> {
  const { portal, user } = session;
  return db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const row = await p.marketingSpend.create({
      sourceId: input.sourceId,
      date: new Date(`${input.date}T00:00:00Z`),
      kind: input.kind,
      amount: m(input.amount),
      note: input.note || null,
      createdById: user.id,
    });
    await writeAudit(tx, {
      portalId: portal.id,
      actor: actorOf(session),
      action: 'FINANCE_CREATED',
      entityType: 'MARKETING_SPEND',
      entityId: row.id,
      after: {
        amount: row.amount.toString(),
        kind: row.kind,
        sourceId: row.sourceId,
        channel: input.channel ?? row.sourceId,
        date: input.date,
      },
    });
    return { id: row.id };
  });
}

/** Soft-deletes a spend row; the deletion lands in the audit log. */
export async function deleteSpend(session: ResolvedSession, id: string): Promise<void> {
  const { portal, user } = session;
  await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const row = await p.marketingSpend.findByIdOrThrow(id);
    await p.marketingSpend.softDelete(row.id, user.id);
    await writeAudit(tx, {
      portalId: portal.id,
      actor: actorOf(session),
      action: 'FINANCE_DELETED',
      entityType: 'MARKETING_SPEND',
      entityId: row.id,
      before: {
        amount: row.amount.toString(),
        kind: row.kind,
        sourceId: row.sourceId,
        date: toDay(row.date),
      },
    });
  });
}

/** Saves the month's plan (for all channels when sourceId is ''). */
export async function savePlan(session: ResolvedSession, input: SavePlanInput): Promise<PlanDto> {
  const { portal, user } = session;
  return db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const before = await p.marketingPlan.find(input.month, input.sourceId);
    const row = await p.marketingPlan.upsert(input.month, input.sourceId, {
      budget: input.budget === null ? null : m(input.budget),
      leads: input.leads,
      qualifiedLeads: input.qualifiedLeads,
      sales: input.sales,
      updatedById: user.id,
    });
    const snap = (r: typeof row | null) =>
      r
        ? {
            month: r.month,
            sourceId: r.sourceId,
            amount: r.budget?.toString() ?? null,
            leads: r.leads,
            qualifiedLeads: r.qualifiedLeads,
            sales: r.sales,
          }
        : undefined;
    await writeAudit(tx, {
      portalId: portal.id,
      actor: actorOf(session),
      action: before ? 'FINANCE_UPDATED' : 'FINANCE_CREATED',
      entityType: 'MARKETING_PLAN',
      entityId: row.id,
      before: snap(before),
      after: snap(row),
    });
    return {
      sourceId: row.sourceId,
      budget: row.budget?.toFixed(2) ?? null,
      leads: row.leads,
      qualifiedLeads: row.qualifiedLeads,
      sales: row.sales,
    };
  });
}

/** Which traffic stages count as a qualified lead; empty means the default rule. */
export async function saveQualifiedStages(scope: PortalScope, stages: string[]): Promise<void> {
  if (stages.length > 200) throw badRequest('Слишком много стадий');
  await scope.marketingConfig.save([...new Set(stages)]);
}

// ─── Drill-down (ADR-049) ────────────────────────────────────────────────────

export type ItemKind = 'leads' | 'qualified' | 'sales' | 'deals' | 'inwork' | 'won' | 'lost';

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  leads: 'Лиды',
  qualified: 'Квал. лиды',
  sales: 'Продажи за период',
  deals: 'Сделки, созданные за период',
  inwork: 'В работе',
  won: 'Выиграны',
  lost: 'Проиграны',
};

export interface ItemRowDto {
  key: string;
  title: string;
  section: string;
  source: string;
  manager: string;
  stage: string;
  semantic: string;
  amount: string;
  createdAt: string;
  closedAt: string | null;
  url: string;
}

/** The CRM elements behind a marketing or sales figure, each linking to its Bitrix24 card. */
export async function marketingItems(
  session: ResolvedSession,
  scope: PortalScope,
  period: AnalyticsPeriod,
  tz: string,
  q: { kind: ItemKind; source?: string; manager?: string },
): Promise<{ rows: ItemRowDto[]; amount: string; errors: string[] }> {
  const [data, config, users] = await Promise.all([
    loadMarketingData(session, scope, period, tz),
    scope.marketingConfig.get(),
    scope.user.findMany(),
  ]);
  const people = new Map(users.map((u) => [u.bitrixUserId, `${u.firstName} ${u.lastName}`.trim()]));
  const picked = new Set(config?.qualifiedStages ?? []);
  const first = firstStages(data.leadStages);

  const base: CrmElement[] =
    q.kind === 'leads'
      ? data.leads
      : q.kind === 'qualified'
        ? data.leads.filter((l) => isQualified(l, picked, first))
        : q.kind === 'sales'
          ? data.won
          : data.created.filter(
              (d) =>
                q.kind === 'deals' ||
                (q.kind === 'inwork' && d.semantic === 'process') ||
                (q.kind === 'won' && d.semantic === 'success') ||
                (q.kind === 'lost' && d.semantic === 'fail'),
            );
  const source = q.source === 'none' ? NO_SOURCE : q.source;
  const list = base
    .filter((e) => source === undefined || (e.sourceId ?? NO_SOURCE) === source)
    .filter(
      (e) => !q.manager || (q.manager === 'none' ? !e.assignedById : e.assignedById === q.manager),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    rows: list.map((e) => ({
      key: `${e.entityTypeId}:${e.id}`,
      title: e.title || `${data.sections[e.entityTypeId] ?? 'Элемент'} №${e.id}`,
      section: data.sections[e.entityTypeId] ?? '',
      source: sourceName(data.sources, e.sourceId ?? NO_SOURCE),
      manager: e.assignedById ? (people.get(e.assignedById) ?? `Сотрудник ${e.assignedById}`) : '—',
      stage: e.stageId ? (data.stages[e.stageId]?.name ?? e.stageId) : '—',
      semantic: e.semantic,
      amount: m(e.opportunity || '0').toFixed(2),
      createdAt: e.createdAt.toISOString(),
      closedAt: e.closedAt?.toISOString() ?? null,
      url: crmElementUrl(session.portal.domain, e.entityTypeId, e.id),
    })),
    amount: sum(list.map((e) => m(e.opportunity || '0'))).toFixed(2),
    errors: data.errors,
  };
}
