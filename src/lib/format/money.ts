import type { Decimal } from '@/domain/finance/money';
import { DASH, NBSP, formatNumber } from './number';

/**
 * The ONLY place the ₽ sign lives (ТЗ §11). `null`/`undefined` render as "—" (ТЗ §16).
 * "1 250 000 ₽", "1 000,5 ₽", "−200 000 ₽".
 */
export function formatRub(value: Decimal | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return `${formatNumber(value)}${NBSP}₽`;
}
