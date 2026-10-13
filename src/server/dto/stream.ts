import { z } from 'zod';
import { m } from '@/domain/finance/money';

/** Empty -> null; otherwise a non-negative amount with at most 2 decimals. */
const money = (max: number) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v == null ? '' : String(v).trim().replace(',', '.').replace(/\s+/g, '')))
    .refine(
      (s) => s === '' || /^\d+(\.\d{1,2})?$/.test(s),
      'Число, не более 2 знаков после запятой',
    )
    .refine((s) => s === '' || m(s).lte(max), `Не больше ${max.toLocaleString('ru-RU')}`)
    .transform((s) => (s === '' ? null : s));

const date = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД'),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((v) => (v ? v : null));

/** A project direction (ADR-052). */
export const streamSchema = z.object({
  kind: z.enum(['SUPPORT', 'IMPLEMENTATION', 'DEVELOPMENT', 'CONSULTING', 'OTHER']),
  name: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  status: z.enum(['ACTIVE', 'COMPLETED']).default('ACTIVE'),
  startDate: date,
  endDate: date,
  budget: money(100_000_000_000),
  monthlyFee: money(100_000_000),
  hourRate: money(1_000_000),
  hoursLimit: money(744),
  memberIds: z.array(z.string().min(1).max(100)).max(200).default([]),
  comment: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export type StreamInput = z.infer<typeof streamSchema>;
