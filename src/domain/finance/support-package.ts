import { m, round2, sum, ZERO, type Decimal } from './money';
import { hoursRateAmount } from './calculations';

/**
 * Support-package pricing (ADR-034): a monthly fee covers a package of hours; hours beyond it
 * are billed at the hourly rate. With neither a package nor a fee every hour is billed at the
 * rate (pure hourly support, ADR-045). Seconds come from the analytics engine; money is
 * Decimal from here on (ТЗ §17).
 */

export interface SupportPackage {
  monthlyFee: Decimal | null;
  hourRate: Decimal | null;
}

export interface SupportMonthInput {
  label: string;
  totalSeconds: number;
  limitSeconds: number | null;
  overageSeconds: number;
}

export interface SupportMonthCost extends SupportMonthInput {
  fee: Decimal;
  /** Seconds billed at the hourly rate: overage, or all of it for pure hourly support. */
  billableSeconds: number;
  overageHours: Decimal;
  overageCost: Decimal;
}

export interface SupportCost {
  /** False when neither a fee nor a rate is set — the report then shows hours only. */
  hasPricing: boolean;
  months: SupportMonthCost[];
  feeTotal: Decimal;
  overageCost: Decimal;
  total: Decimal;
}

export function secondsToHours(seconds: number): Decimal {
  return m(seconds).div(3600);
}

export function supportCost(pkg: SupportPackage, months: SupportMonthInput[]): SupportCost {
  const fee = pkg.monthlyFee ?? ZERO;
  const rate = pkg.hourRate ?? ZERO;
  const hourly = !fee.gt(0);
  const rows = months.map((mo) => {
    const billableSeconds = mo.limitSeconds === null && hourly ? mo.totalSeconds : mo.overageSeconds;
    const overageHours = secondsToHours(billableSeconds);
    return { ...mo, fee, billableSeconds, overageHours, overageCost: round2(overageHours.times(rate)) };
  });
  const feeTotal = round2(fee.times(rows.length));
  const overageCost = round2(sum(rows.map((r) => r.overageCost)));
  return {
    hasPricing: fee.gt(0) || rate.gt(0),
    months: rows,
    feeTotal,
    overageCost,
    total: round2(feeTotal.plus(overageCost)),
  };
}

// ─── Support month → finance (ADR-045) ──────────────────────────────────────

export interface WorkerTime {
  /** Bitrix24 user id. */
  userId: string;
  seconds: number;
  /** The employee's hourly rate; null when it isn't set. */
  rate: Decimal | null;
}

export interface WorkerCost {
  userId: string;
  /** Rounded to the storage precision first, so amount = hours × rate exactly (ТЗ §14). */
  hours: Decimal;
  rate: Decimal | null;
  amount: Decimal | null;
}

export interface SupportMonthResult {
  income: Decimal;
  expense: Decimal;
  profit: Decimal;
  workers: WorkerCost[];
  /** People who worked but have no rate: their time is not in the expense. */
  missingRates: string[];
}

/**
 * What a support month earns and costs: income by the package/hourly pricing, expense as each
 * specialist's hours × their rate.
 */
export function supportMonthResult(pkg: SupportPackage, month: SupportMonthInput, workers: WorkerTime[]): SupportMonthResult {
  const income = supportCost(pkg, [month]).total;
  const rows: WorkerCost[] = workers
    .filter((w) => w.seconds > 0)
    .map((w) => {
      const hours = secondsToHours(w.seconds).toDecimalPlaces(2);
      return { userId: w.userId, hours, rate: w.rate, amount: w.rate ? hoursRateAmount(hours, w.rate) : null };
    });
  const expense = round2(sum(rows.map((r) => r.amount ?? ZERO)));
  return {
    income,
    expense,
    profit: income.minus(expense),
    workers: rows,
    missingRates: rows.filter((r) => r.amount === null).map((r) => r.userId),
  };
}
