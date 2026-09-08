import { m, type Decimal } from '@/domain/finance/money';
import { DASH, NBSP, formatNumber } from './number';

/**
 * The ONLY place the ₽ sign lives (ТЗ §11). `null`/`undefined` render as "—" (ТЗ §16).
 * "1 250 000 ₽", "1 000,5 ₽", "−200 000 ₽".
 */
export function formatRub(value: Decimal | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return `${formatNumber(value)}${NBSP}₽`;
}

/** Same, from an API string value (economics are serialised as strings; null stays null). */
export function formatRubStr(value: string | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return formatRub(m(value));
}
