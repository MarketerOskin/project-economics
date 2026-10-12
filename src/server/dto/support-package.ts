import { z } from 'zod';
import { m } from '@/domain/finance/money';

/** Empty -> null (not set); otherwise a non-negative number with at most 2 decimals. */
const nonNegative = (max: number, label: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (v === null ? '' : String(v).trim().replace(',', '.').replace(/\s+/g, '')))
    .refine((s) => s === '' || /^\d+(\.\d{1,2})?$/.test(s), 'Число, не более 2 знаков после запятой')
    .refine((s) => s === '' || m(s).lte(max), `${label}: не больше ${max.toLocaleString('ru-RU')}`)
    .transform((s) => (s === '' ? null : s));

/** PATCH /api/projects/:id/support-package (ADR-034). */
export const supportPackageSchema = z.object({
  hoursLimit: nonNegative(744, 'Часов в месяц'),
  monthlyFee: nonNegative(100_000_000, 'Абонентская плата'),
  hourRate: nonNegative(1_000_000, 'Ставка'),
});

export type SupportPackageInput = z.infer<typeof supportPackageSchema>;
