import { m, round2, ZERO, type Decimal } from './money';

/** profit = income − expense. */
export function profit(income: Decimal, expense: Decimal): Decimal {
  return income.minus(expense);
}

/**
 * margin = profit / income × 100, as a Decimal percentage.
 * Returns `null` when income is zero — the UI renders "—", the API serializes null (ТЗ §16).
 * Never returns Infinity / NaN / a misleading 0%.
 */
export function margin(income: Decimal, profitValue: Decimal): Decimal | null {
  if (income.isZero()) return null;
  return profitValue.div(income).times(100);
}

/**
 * HOURS_RATE amount = hours × rate, rounded to 2dp. This is the authoritative computation;
 * the server calls it and ignores any client-supplied amount (ТЗ §14).
 */
export function hoursRateAmount(hours: Decimal, hourlyRate: Decimal): Decimal {
  return round2(hours.times(hourlyRate));
}

/** deviation = fact − plan (ТЗ §16). Applies to income, expense and profit alike. */
export function deviation(fact: Decimal, plan: Decimal): Decimal {
  return fact.minus(plan);
}

/**
 * Difference between two margins, in percentage points (e.g. "+4.2 п.п.", ТЗ §16).
 * Null if either margin is undefined.
 */
export function marginDeltaPoints(
  factMargin: Decimal | null,
  planMargin: Decimal | null,
): Decimal | null {
  if (factMargin === null || planMargin === null) return null;
  return factMargin.minus(planMargin);
}

/** Convenience re-exports for callers that only need the primitives. */
export { m, ZERO };
