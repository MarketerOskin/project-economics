import { m, round2, sum, ZERO, type Decimal } from './money';

/**
 * Support-package pricing (ADR-034): a monthly fee covers a package of hours; hours beyond it
 * are billed at the hourly rate. Overage seconds come from the analytics engine; money is
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
  const rows = months.map((mo) => {
    const overageHours = secondsToHours(mo.overageSeconds);
    return { ...mo, fee, overageHours, overageCost: round2(overageHours.times(rate)) };
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
