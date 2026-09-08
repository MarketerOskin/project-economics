import { deviation, margin, marginDeltaPoints, profit } from './calculations';
import { m, sum, ZERO, type Decimal } from './money';
import type {
  CategoryAmount,
  EntryInput,
  ProjectEconomics,
  TimeGranularity,
  TimeSeriesPoint,
} from './types';

/** The single choke point for the "deleted rows never count" rule (ТЗ §31). */
function live(entries: readonly EntryInput[]): EntryInput[] {
  return entries.filter((e) => e.deletedAt === null);
}

function totalOf(
  entries: readonly EntryInput[],
  direction: EntryInput['direction'],
  budgetType: EntryInput['budgetType'],
): Decimal {
  return sum(
    entries.filter((e) => e.direction === direction && e.budgetType === budgetType).map((e) => e.amount),
  );
}

function economicsFromTotals(input: {
  factIncome: Decimal;
  factExpense: Decimal;
  planIncome: Decimal;
  planExpense: Decimal;
}): ProjectEconomics {
  const { factIncome, factExpense, planIncome, planExpense } = input;
  const factProfit = profit(factIncome, factExpense);
  const planProfit = profit(planIncome, planExpense);
  const factMargin = margin(factIncome, factProfit);
  const planMargin = margin(planIncome, planProfit);

  return {
    factIncome,
    factExpense,
    factProfit,
    factMargin,
    planIncome,
    planExpense,
    planProfit,
    planMargin,
    incomeDeviation: deviation(factIncome, planIncome),
    expenseDeviation: deviation(factExpense, planExpense),
    profitDeviation: deviation(factProfit, planProfit),
    marginDeltaPoints: marginDeltaPoints(factMargin, planMargin),
  };
}

/** Full plan/fact economics for one project over whatever entries are passed in. */
export function aggregateProject(entries: readonly EntryInput[]): ProjectEconomics {
  const rows = live(entries);
  return economicsFromTotals({
    factIncome: totalOf(rows, 'INCOME', 'FACT'),
    factExpense: totalOf(rows, 'EXPENSE', 'FACT'),
    planIncome: totalOf(rows, 'INCOME', 'PLAN'),
    planExpense: totalOf(rows, 'EXPENSE', 'PLAN'),
  });
}

/** Company economics = sum of project economics; margins recomputed from the totals (ТЗ §11). */
export function aggregateCompany(perProject: readonly ProjectEconomics[]): ProjectEconomics {
  const fold = (pick: (p: ProjectEconomics) => Decimal): Decimal =>
    sum(perProject.map(pick));

  return economicsFromTotals({
    factIncome: fold((p) => p.factIncome),
    factExpense: fold((p) => p.factExpense),
    planIncome: fold((p) => p.planIncome),
    planExpense: fold((p) => p.planExpense),
  });
}

/** Expense totals by category for a budget type, non-deleted, largest first (ТЗ §20). */
export function expenseStructure(
  entries: readonly EntryInput[],
  budgetType: EntryInput['budgetType'],
): CategoryAmount[] {
  const byCategory = new Map<string, Decimal>();
  for (const e of live(entries)) {
    if (e.direction !== 'EXPENSE' || e.budgetType !== budgetType) continue;
    byCategory.set(e.categoryId, (byCategory.get(e.categoryId) ?? ZERO).plus(e.amount));
  }
  return [...byCategory.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount.comparedTo(a.amount));
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function bucketStart(d: Date, granularity: TimeGranularity): Date {
  const day = startOfDay(d);
  if (granularity === 'day') return day;
  if (granularity === 'month') {
    return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  }
  // week: ISO-ish, snap back to Monday
  const dow = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - dow * 86_400_000);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function advance(d: Date, granularity: TimeGranularity): Date {
  if (granularity === 'day') return new Date(d.getTime() + 86_400_000);
  if (granularity === 'week') return new Date(d.getTime() + 7 * 86_400_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/**
 * Income/expense over time, plan and fact as separate series (ТЗ §20 chart 1).
 * Produces a contiguous bucket per granularity step across [from, to], zero-filled.
 */
export function timeSeries(
  entries: readonly EntryInput[],
  opts: { from: Date; to: Date; granularity: TimeGranularity },
): TimeSeriesPoint[] {
  const { from, to, granularity } = opts;
  const buckets = new Map<string, TimeSeriesPoint>();

  for (
    let cursor = bucketStart(from, granularity);
    cursor.getTime() <= to.getTime();
    cursor = advance(cursor, granularity)
  ) {
    buckets.set(isoDate(cursor), {
      bucket: isoDate(cursor),
      factIncome: ZERO,
      factExpense: ZERO,
      planIncome: ZERO,
      planExpense: ZERO,
    });
  }

  for (const e of live(entries)) {
    const key = isoDate(bucketStart(e.operationDate, granularity));
    const point = buckets.get(key);
    if (!point) continue;
    const field =
      e.budgetType === 'FACT'
        ? e.direction === 'INCOME'
          ? 'factIncome'
          : 'factExpense'
        : e.direction === 'INCOME'
          ? 'planIncome'
          : 'planExpense';
    point[field] = point[field].plus(e.amount);
  }

  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export { m };
