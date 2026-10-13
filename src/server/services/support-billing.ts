import type { AppUser } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withPortal, type PortalScope } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { badRequest } from '@/lib/errors';
import { m } from '@/domain/finance/money';
import { supportMonthResult, type SupportMonthResult } from '@/domain/finance/support-package';
import {
  adjacentMonths,
  dayKey,
  monthPeriod,
  monthSecondsByPerson,
  monthUsage,
  zonedParts,
} from '@/domain/analytics';
import { formatHours } from '@/lib/format';
import { loadAnalytics, type AnalyticsProject } from './analytics';
import { assertProjectAndCategory } from './finance-write';
import type { ResolvedSession } from '@/lib/auth/resolve';

/**
 * Support month → finance (ADR-045). For every project with support pricing, the hours
 * Bitrix24 logged in a month give the income (package fee + hours over it × price per hour,
 * or every hour × price when there's no package) and the expense (each specialist's hours ×
 * their rate). One click writes them as FACT entries; posting again replaces them.
 */

export interface SupportWorkerDto {
  name: string;
  hours: string;
  rate: string | null;
  amount: string | null;
  /** Already written via «Часы к подтверждению» — not counted again. */
  viaTimeDrafts: boolean;
}

export interface SupportMonthDto {
  projectId: string;
  projectName: string;
  clientName: string | null;
  month: string;
  monthLabel: string;
  /** The month is still running: numbers will grow. */
  current: boolean;
  seconds: number;
  hours: string;
  income: string;
  expense: string;
  profit: string;
  workers: SupportWorkerDto[];
  missingRates: string[];
  posted: { income: string; expense: string; seconds: number; at: string } | null;
  /** Posted, but hours or money have moved since. */
  changed: boolean;
}

interface Computed {
  project: AnalyticsProject;
  month: string;
  label: string;
  seconds: number;
  result: SupportMonthResult;
  /** AppUser per Bitrix24 user id among the workers. */
  users: Map<string, AppUser>;
  /** Bitrix24 user ids whose month is already in finance through time drafts. */
  viaDrafts: Set<string>;
}

function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}

function hasPricing(p: AnalyticsProject): boolean {
  return (
    (p.monthlyFee !== null && m(p.monthlyFee).gt(0)) || (p.hourRate !== null && m(p.hourRate).gt(0))
  );
}

/** The previous and the current month, 'YYYY-MM', in the analytics time zone. */
export function billingMonths(now: Date, tz: string): [string, string] {
  const t = zonedParts(now, tz);
  const current = `${t.year}-${String(t.month).padStart(2, '0')}`;
  return [adjacentMonths(current).prev, current];
}

/** Month start (UTC midnight of the 1st) and the day after its end, for @db.Date filters. */
function monthDates(month: string): { first: Date; next: Date } {
  return {
    first: new Date(`${month}-01T00:00:00Z`),
    next: new Date(`${adjacentMonths(month).next}-01T00:00:00Z`),
  };
}

async function compute(
  scope: PortalScope,
  project: AnalyticsProject,
  month: string,
  tz: string,
  now: Date,
  users: AppUser[],
): Promise<Computed> {
  const [y, mo] = month.split('-').map(Number) as [number, number];
  const period = monthPeriod(y, mo, tz);
  const usage = monthUsage(project, period, tz, now)[0]!;
  const byBitrix = new Map(users.map((u) => [u.bitrixUserId, u]));

  // Months already written employee by employee from Bitrix24 tasks (ADR-027) stay as they are.
  const { first, next } = monthDates(month);
  const drafted = await scope.timeDraft.findMany({
    where: { projectId: project.projectId, status: 'APPROVED', workDate: { gte: first, lt: next } },
    select: { employeeId: true },
  });
  const draftedIds = new Set(drafted.map((d) => d.employeeId));
  const viaDrafts = new Set(users.filter((u) => draftedIds.has(u.id)).map((u) => u.bitrixUserId));

  const workers = [...monthSecondsByPerson(project, month, tz, now)]
    .filter(([userId]) => !viaDrafts.has(userId))
    .map(([userId, seconds]) => {
      const rate = byBitrix.get(userId)?.hourlyRate;
      return { userId, seconds, rate: rate ? m(rate.toString()) : null };
    });

  const result = supportMonthResult(
    {
      monthlyFee: project.monthlyFee !== null ? m(project.monthlyFee) : null,
      hourRate: project.hourRate !== null ? m(project.hourRate) : null,
    },
    usage,
    workers,
  );
  return {
    project,
    month,
    label: usage.label,
    seconds: usage.totalSeconds,
    result,
    users: byBitrix,
    viaDrafts,
  };
}

function nameOf(c: Computed, userId: string): string {
  const u = c.users.get(userId);
  return (u && fullName(u)) || `Сотрудник ${userId}`;
}

/** Support months of every priced project: the previous one and the one running now. */
export async function listSupportBilling(
  session: ResolvedSession,
  scope: PortalScope,
): Promise<SupportMonthDto[]> {
  const world = await loadAnalytics(session, scope);
  const priced = world.projects.filter(hasPricing);
  if (!priced.length) return [];

  const months = billingMonths(world.now, world.tz);
  const [users, postings] = await Promise.all([
    scope.user.findMany(),
    scope.supportPosting.findMany({
      projectId: { in: priced.map((p) => p.projectId) },
      month: { in: months },
    }),
  ]);
  const posted = new Map(postings.map((p) => [`${p.projectId}:${p.month}`, p]));

  const out: SupportMonthDto[] = [];
  for (const project of priced) {
    for (const month of months) {
      const c = await compute(scope, project, month, world.tz, world.now, users);
      if (
        c.seconds === 0 &&
        !posted.has(`${project.projectId}:${month}`) &&
        c.result.income.isZero()
      )
        continue;
      const p = posted.get(`${project.projectId}:${month}`);
      const draftWorkers: SupportWorkerDto[] = [...c.viaDrafts].map((userId) => ({
        name: nameOf(c, userId),
        hours: '',
        rate: null,
        amount: null,
        viaTimeDrafts: true,
      }));
      out.push({
        projectId: project.projectId,
        projectName: project.name,
        clientName: project.clientName,
        month,
        monthLabel: c.label,
        current: month === months[1],
        seconds: c.seconds,
        hours: formatHours(c.seconds),
        income: c.result.income.toFixed(2),
        expense: c.result.expense.toFixed(2),
        profit: c.result.profit.toFixed(2),
        workers: [
          ...c.result.workers.map((w) => ({
            name: nameOf(c, w.userId),
            hours: w.hours.toFixed(2),
            rate: w.rate?.toFixed(2) ?? null,
            amount: w.amount?.toFixed(2) ?? null,
            viaTimeDrafts: false,
          })),
          ...draftWorkers,
        ],
        missingRates: c.result.missingRates.map((id) => nameOf(c, id)),
        posted: p
          ? {
              income: p.incomeAmount.toFixed(2),
              expense: p.expenseAmount.toFixed(2),
              seconds: p.seconds,
              at: p.postedAt.toISOString(),
            }
          : null,
        changed: p
          ? !p.incomeAmount.equals(c.result.income) ||
            !p.expenseAmount.equals(c.result.expense) ||
            p.seconds !== c.seconds
          : false,
      });
    }
  }
  return out;
}

/**
 * Write one support month into the project's finance: a FACT income entry and one FACT
 * HOURS_RATE expense per specialist with a rate. Amounts are recomputed here from Bitrix24,
 * never taken from the client. A month posted before has its old entries soft-deleted first,
 * every step in the audit log.
 */
export async function postSupportMonth(
  session: ResolvedSession,
  scope: PortalScope,
  input: { projectId: string; month: string; incomeCategoryId: string; expenseCategoryId: string },
): Promise<{ income: string; expense: string; entries: number }> {
  await assertProjectAndCategory(scope, input.projectId, input.incomeCategoryId, 'INCOME');
  await assertProjectAndCategory(scope, input.projectId, input.expenseCategoryId, 'EXPENSE');

  const world = await loadAnalytics(session, scope, { projectId: input.projectId });
  const project = world.projects[0];
  if (!project) throw badRequest('Проект не связан с Битрикс24 или в архиве — часов по нему нет');
  if (!hasPricing(project)) throw badRequest('У проекта не задана цена часа или абонентская плата');
  if (!billingMonths(world.now, world.tz).includes(input.month))
    throw badRequest('Можно провести только прошлый или текущий месяц');

  const users = await scope.user.findMany();
  const c = await compute(scope, project, input.month, world.tz, world.now, users);
  const previous = await scope.supportPosting.find(input.projectId, input.month);

  // Dated the last day of the month, or today while the month is still running.
  const today = dayKey(world.now, world.tz);
  const { next } = monthDates(input.month);
  const lastDay = new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10);
  const operationDate = new Date(`${today < lastDay ? today : lastDay}T00:00:00Z`);
  const note = `Поддержка за ${c.label.toLowerCase()}: ${formatHours(c.seconds)} ч (авторасчёт по часам Битрикс24)`;

  const { portal, user } = session;
  const actor = { appUserId: user.id, name: fullName(user) };

  const entryIds = await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    for (const id of previous?.entryIds ?? []) {
      const old = await tx.financialEntry.findFirst({
        where: { id, portalId: portal.id, deletedAt: null },
      });
      if (!old) continue;
      await p.entry.update(old.id, { deletedAt: new Date(), deletedById: user.id });
      await writeAudit(tx, {
        portalId: portal.id,
        actor,
        action: 'FINANCE_DELETED',
        entityType: 'FINANCIAL_ENTRY',
        entityId: old.id,
        projectId: old.projectId,
        before: {
          amount: old.amount.toString(),
          direction: old.direction,
          budgetType: old.budgetType,
          source: 'support-hours',
        },
      });
    }

    const created: string[] = [];
    if (c.result.income.gt(0)) {
      const e = await p.entry.create({
        projectId: input.projectId,
        categoryId: input.incomeCategoryId,
        direction: 'INCOME',
        budgetType: 'FACT',
        calculationMode: 'FIXED',
        operationDate,
        amount: c.result.income,
        description: note,
        createdById: user.id,
        updatedById: user.id,
      });
      created.push(e.id);
    }
    for (const w of c.result.workers) {
      const employee = c.users.get(w.userId);
      if (!w.amount || !w.rate || !employee || w.amount.isZero()) continue;
      const e = await p.entry.create({
        projectId: input.projectId,
        categoryId: input.expenseCategoryId,
        direction: 'EXPENSE',
        budgetType: 'FACT',
        calculationMode: 'HOURS_RATE',
        operationDate,
        amount: w.amount,
        hours: w.hours,
        hourlyRate: w.rate,
        employeeId: employee.id,
        description: note,
        createdById: user.id,
        updatedById: user.id,
      });
      created.push(e.id);
    }
    for (const id of created) {
      const e = await tx.financialEntry.findUniqueOrThrow({ where: { id } });
      await writeAudit(tx, {
        portalId: portal.id,
        actor,
        action: 'FINANCE_CREATED',
        entityType: 'FINANCIAL_ENTRY',
        entityId: e.id,
        projectId: e.projectId,
        after: {
          direction: e.direction,
          budgetType: e.budgetType,
          amount: e.amount.toString(),
          source: 'support-hours',
        },
      });
    }

    await p.supportPosting.upsert(input.projectId, input.month, {
      seconds: c.seconds,
      incomeAmount: c.result.income,
      expenseAmount: c.result.expense,
      entryIds: created,
      postedAt: new Date(),
      postedById: user.id,
    });
    return created;
  });

  return {
    income: c.result.income.toFixed(2),
    expense: c.result.expense.toFixed(2),
    entries: entryIds.length,
  };
}
