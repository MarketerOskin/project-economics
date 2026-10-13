import { m, sum, ZERO, type Decimal } from './money';

/**
 * Marketing and sales by channel (ADR-048). A channel is a Bitrix24 source (SOURCE_ID).
 * Pure: CRM elements and spend rows in, per-channel numbers out. CPL, CPL-2 and CAC are
 * counted from the budget actually spent, never from money paid into an account.
 */

export type StageSemantic = 'success' | 'fail' | 'process';

/** One CRM element (lead, deal or smart-process item) as marketing needs it. */
export interface CrmElement {
  entityTypeId: number;
  id: string;
  /** Bitrix24 SOURCE_ID; null when the element has none. */
  sourceId: string | null;
  assignedById: string | null;
  stageId: string | null;
  semantic: StageSemantic;
  opportunity: string;
  createdAt: Date;
  closedAt: Date | null;
}

export interface SpendRow {
  sourceId: string;
  kind: 'SPENT' | 'PAID';
  amount: Decimal;
}

/** Key for elements without a source. */
export const NO_SOURCE = '';
export const NO_SOURCE_NAME = 'Без источника';

/** a / b, or null when b is zero (no division by zero, ТЗ §16). */
export function ratio(a: Decimal, b: Decimal | number): Decimal | null {
  const d = m(b);
  return d.isZero() ? null : a.div(d);
}

/** a / b × 100, or null when b is zero. */
export function percentOf(a: Decimal | number, b: Decimal | number): Decimal | null {
  const r = ratio(m(a), b);
  return r === null ? null : r.times(100);
}

export interface ChannelNumbers {
  spent: Decimal;
  paid: Decimal;
  leads: number;
  qualified: number;
  sales: number;
  revenue: Decimal;
}

export interface ChannelMetrics extends ChannelNumbers {
  /** Spent ÷ leads. */
  cpl: Decimal | null;
  /** Spent ÷ qualified leads. */
  cpl2: Decimal | null;
  /** Spent ÷ sales (customer acquisition cost). */
  cac: Decimal | null;
  leadToQualified: Decimal | null;
  qualifiedToSale: Decimal | null;
  leadToSale: Decimal | null;
  /** Revenue ÷ sales. */
  avgCheck: Decimal | null;
  /** (Revenue − spent) ÷ spent × 100. */
  romi: Decimal | null;
}

/** Cost per unit, or null without spend: an organic channel has no CPL, not a CPL of zero. */
const cost = (spent: Decimal, units: number) => (spent.isZero() ? null : ratio(spent, units));

export function channelMetrics(n: ChannelNumbers): ChannelMetrics {
  return {
    ...n,
    cpl: cost(n.spent, n.leads),
    cpl2: cost(n.spent, n.qualified),
    cac: cost(n.spent, n.sales),
    leadToQualified: percentOf(n.qualified, n.leads),
    qualifiedToSale: percentOf(n.sales, n.qualified),
    leadToSale: percentOf(n.sales, n.leads),
    avgCheck: ratio(n.revenue, n.sales),
    romi: n.spent.isZero() ? null : percentOf(n.revenue.minus(n.spent), n.spent),
  };
}

export interface ChannelRow extends ChannelMetrics {
  sourceId: string;
  name: string;
}

const empty = (): ChannelNumbers => ({
  spent: ZERO,
  paid: ZERO,
  leads: 0,
  qualified: 0,
  sales: 0,
  revenue: ZERO,
});

/**
 * The «Каналы» table: one row per source that had spend, leads or sales in the period,
 * busiest first, plus the total. `leads` are traffic elements created in the period with
 * `qualified` marking the qualified ones; `won` are sales won (closed) in the period.
 */
export function channelReport(input: {
  sourceNames: Record<string, string>;
  leads: Array<CrmElement & { qualified: boolean }>;
  won: CrmElement[];
  spends: SpendRow[];
}): { rows: ChannelRow[]; total: ChannelMetrics } {
  const by = new Map<string, ChannelNumbers>();
  const at = (id: string | null) => {
    const k = id ?? NO_SOURCE;
    let row = by.get(k);
    if (!row) by.set(k, (row = empty()));
    return row;
  };
  for (const s of input.spends) {
    const row = at(s.sourceId || null);
    if (s.kind === 'SPENT') row.spent = row.spent.plus(s.amount);
    else row.paid = row.paid.plus(s.amount);
  }
  for (const l of input.leads) {
    const row = at(l.sourceId);
    row.leads++;
    if (l.qualified) row.qualified++;
  }
  for (const w of input.won) {
    const row = at(w.sourceId);
    row.sales++;
    row.revenue = row.revenue.plus(m(w.opportunity || '0'));
  }

  const rows = [...by.entries()]
    .map(([sourceId, n]) => ({
      sourceId,
      name: sourceId === NO_SOURCE ? NO_SOURCE_NAME : (input.sourceNames[sourceId] ?? sourceId),
      ...channelMetrics(n),
    }))
    .sort((a, b) => b.spent.comparedTo(a.spent) || b.leads - a.leads || b.sales - a.sales);

  const all = [...by.values()];
  const total = channelMetrics({
    spent: sum(all.map((n) => n.spent)),
    paid: sum(all.map((n) => n.paid)),
    leads: all.reduce((a, n) => a + n.leads, 0),
    qualified: all.reduce((a, n) => a + n.qualified, 0),
    sales: all.reduce((a, n) => a + n.sales, 0),
    revenue: sum(all.map((n) => n.revenue)),
  });
  return { rows, total };
}

/**
 * Whether a traffic element counts as a qualified lead. With stages picked in the settings,
 * exactly those stages; otherwise a won/converted element or one moved past the first stage
 * of its funnel (`firstStages`). Failed elements are not qualified by default.
 */
export function isQualified(
  e: Pick<CrmElement, 'stageId' | 'semantic'>,
  picked: ReadonlySet<string>,
  firstStages: ReadonlySet<string>,
): boolean {
  if (picked.size > 0) return e.stageId !== null && picked.has(e.stageId);
  if (e.semantic === 'success') return true;
  if (e.semantic === 'fail') return false;
  return e.stageId !== null && !firstStages.has(e.stageId);
}

// ─── Plan / fact ─────────────────────────────────────────────────────────────

export interface PlanNumbers {
  budget: Decimal | null;
  leads: number | null;
  qualified: number | null;
  sales: number | null;
}

export interface PlanFactRow {
  key: 'budget' | 'leads' | 'qualified' | 'sales';
  plan: Decimal | null;
  fact: Decimal;
  /** Fact ÷ plan × 100. */
  done: Decimal | null;
  /** Where the month ends at the current pace; equals fact for a finished month. */
  forecast: Decimal;
}

/**
 * Plan against fact for one month. `elapsedDays` of `totalDays` have passed (a past month
 * passes all of them); the forecast extends the pace so far to the whole month.
 */
export function planFact(
  plan: PlanNumbers,
  fact: Pick<ChannelNumbers, 'spent' | 'leads' | 'qualified' | 'sales'>,
  elapsedDays: number,
  totalDays: number,
): PlanFactRow[] {
  const pace = (v: Decimal) =>
    elapsedDays <= 0 ? ZERO : elapsedDays >= totalDays ? v : v.times(totalDays).div(elapsedDays);
  const row = (
    key: PlanFactRow['key'],
    p: Decimal | number | null,
    f: Decimal | number,
    money: boolean,
  ): PlanFactRow => {
    const planValue = p === null ? null : m(p);
    const factValue = m(f);
    const forecast = pace(factValue);
    return {
      key,
      plan: planValue,
      fact: factValue,
      done: planValue === null ? null : percentOf(factValue, planValue),
      forecast: money ? forecast.toDecimalPlaces(2) : forecast.toDecimalPlaces(0),
    };
  };
  return [
    row('budget', plan.budget, fact.spent, true),
    row('leads', plan.leads, fact.leads, false),
    row('qualified', plan.qualified, fact.qualified, false),
    row('sales', plan.sales, fact.sales, false),
  ];
}

/**
 * «Обратный план»: from a sales target back to the qualified leads, leads and budget it
 * takes, at the conversions and CPL seen so far. Null where a rate is unknown.
 */
export function reversePlan(
  sales: number,
  rates: { qualifiedToSale: Decimal | null; leadToQualified: Decimal | null; cpl: Decimal | null },
): { qualified: number | null; leads: number | null; budget: Decimal | null } {
  const need = (target: number | null, pct: Decimal | null) =>
    target === null || pct === null || pct.isZero()
      ? null
      : m(target).times(100).div(pct).ceil().toNumber();
  const qualified = need(sales, rates.qualifiedToSale);
  const leads = need(qualified, rates.leadToQualified);
  const budget =
    leads === null || rates.cpl === null ? null : rates.cpl.times(leads).toDecimalPlaces(2);
  return { qualified, leads, budget };
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export interface SalesRow {
  key: string;
  name: string;
  /** Created in the period, and where those are now. */
  created: number;
  inWork: number;
  won: number;
  lost: number;
  /** Won ÷ created × 100 (of the elements created in the period). */
  conversion: Decimal | null;
  /** Won (closed) in the period, whenever created, and their amount. */
  sales: number;
  revenue: Decimal;
  avgCheck: Decimal | null;
}

/**
 * Sales grouped by `keyOf` (source or manager). `created` are elements created in the period,
 * counted by where they ended up; `won` are elements won in the period, for sales and
 * revenue. Busiest first; no total row.
 */
export function salesBreakdown(
  created: CrmElement[],
  won: CrmElement[],
  keyOf: (e: CrmElement) => string | null,
  nameOf: (key: string) => string,
): SalesRow[] {
  const by = new Map<string, { created: CrmElement[]; won: CrmElement[] }>();
  const at = (e: CrmElement) => {
    const k = keyOf(e) ?? NO_SOURCE;
    let g = by.get(k);
    if (!g) by.set(k, (g = { created: [], won: [] }));
    return g;
  };
  for (const e of created) at(e).created.push(e);
  for (const e of won) at(e).won.push(e);
  return [...by.entries()]
    .map(([key, g]) => salesRow(key, nameOf(key), g.created, g.won))
    .sort((a, b) => b.revenue.comparedTo(a.revenue) || b.created - a.created);
}

export function salesRow(
  key: string,
  name: string,
  created: CrmElement[],
  won: CrmElement[],
): SalesRow {
  const wonOfCreated = created.filter((i) => i.semantic === 'success').length;
  const revenue = sum(won.map((i) => m(i.opportunity || '0')));
  return {
    key,
    name,
    created: created.length,
    inWork: created.filter((i) => i.semantic === 'process').length,
    won: wonOfCreated,
    lost: created.filter((i) => i.semantic === 'fail').length,
    conversion: percentOf(wonOfCreated, created.length),
    sales: won.length,
    revenue,
    avgCheck: ratio(revenue, won.length),
  };
}

/** Mean days from creation to close of won elements; null when none has both dates. */
export function averageCycleDays(won: CrmElement[]): number | null {
  const spans = won
    .filter((i) => i.closedAt && i.closedAt >= i.createdAt)
    .map((i) => (i.closedAt!.getTime() - i.createdAt.getTime()) / 86_400_000);
  return spans.length
    ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10
    : null;
}
