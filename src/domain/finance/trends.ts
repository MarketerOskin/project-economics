import { type Decimal } from './money';
import { margin, profit } from './calculations';

/**
 * Trends for the KPI cards (ADR-065): a per-bucket series for the sparkline and the change
 * against the previous period of the same length.
 */

/** Profit per bucket, fact only. */
export function profitSeries(
  points: readonly { factIncome: Decimal; factExpense: Decimal }[],
): Decimal[] {
  return points.map((p) => profit(p.factIncome, p.factExpense));
}

/** Margin per bucket, fact only; null where the bucket has no income. */
export function marginSeries(
  points: readonly { factIncome: Decimal; factExpense: Decimal }[],
): (Decimal | null)[] {
  return points.map((p) => margin(p.factIncome, profit(p.factIncome, p.factExpense)));
}

/**
 * Relative change, in percent: (current − previous) / |previous| × 100. Null when the
 * previous value is zero — there is nothing to compare against, so the UI shows no badge
 * rather than "+∞ %".
 */
export function relativeChange(current: Decimal, previous: Decimal): Decimal | null {
  if (previous.isZero()) return null;
  return current.minus(previous).div(previous.abs()).times(100);
}
