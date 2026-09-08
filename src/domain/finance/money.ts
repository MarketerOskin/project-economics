import { Prisma } from '@prisma/client';

/**
 * Money and hours are Decimal end-to-end — never JS `number` in finance logic (ТЗ §17).
 * We reuse Prisma's Decimal (decimal.js) so values move to and from the database untouched.
 */
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

// One global configuration: enough precision for aggregates, banker-free half-up rounding.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = string | number | Decimal;

/** Construct a Decimal from a string / number / Decimal. Use everywhere instead of `new`. */
export function m(value: MoneyInput): Decimal {
  return new Decimal(value);
}

export const ZERO: Decimal = m(0);

/** Sum a list of Decimals, starting from zero (empty list -> 0). */
export function sum(values: readonly Decimal[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), ZERO);
}

/** Round to 2 decimal places (money resolution). */
export function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2);
}
