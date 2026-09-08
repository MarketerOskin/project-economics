import { m, type Decimal } from '@/domain/finance/money';
import { DASH, MINUS, NBSP } from './number';

const ruFixed1 = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "30,0 %" / "−40,0 %" / "—" for null (ТЗ §16 — margin can be undefined). */
export function formatPercent(
  value: Decimal | null | undefined,
  opts?: { digits?: number },
): string {
  if (value === null || value === undefined) return DASH;
  const digits = opts?.digits ?? 1;
  const fmt =
    digits === 1
      ? ruFixed1
      : new Intl.NumberFormat('ru-RU', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
  return `${fmt.format(value.toNumber()).replace(/^-/, MINUS)}${NBSP}%`;
}

/**
 * Difference of two margins, in percentage points with an explicit sign: "+4,2 п.п.",
 * "−1,3 п.п.", "0,0 п.п." "—" for null. Never "%" (ТЗ §16).
 */
export function formatPoints(value: Decimal | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  const body = ruFixed1.format(value.abs().toNumber());
  const sign = value.isZero() ? '' : value.isNegative() ? MINUS : '+';
  return `${sign}${body}${NBSP}п.п.`;
}

/** formatPercent from an API string value. */
export function formatPercentStr(value: string | null | undefined, opts?: { digits?: number }): string {
  if (value === null || value === undefined) return DASH;
  return formatPercent(m(value), opts);
}

/** formatPoints from an API string value. */
export function formatPointsStr(value: string | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return formatPoints(m(value));
}
