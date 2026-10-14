import { z } from 'zod';
import { m } from '@/domain/finance/money';

/** A positive amount with at most 2 decimals, as a string for Decimal (accepts «1 500,50»). */
const amount = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).replace(/\s/g, '').replace(',', '.'))
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), 'Сумма — число, не более 2 знаков после запятой')
  .refine((s) => m(s).gt(0), 'Сумма должна быть больше 0');

const count = z.number().int().min(0).max(10_000_000).nullable();

export const createSpendSchema = z.object({
  sourceId: z.string().trim().min(1, 'Выберите канал').max(100),
  /** Shown in the history; the id alone is not readable. */
  channel: z.string().trim().max(200).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')
    .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), 'Некорректная дата'),
  kind: z.enum(['SPENT', 'PAID']).default('SPENT'),
  amount,
  /** A correction: takes `amount` off the channel's spend instead of adding it (ADR-060). */
  subtract: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});
export type CreateSpendInput = z.infer<typeof createSpendSchema>;

export const savePlanSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Месяц в формате ГГГГ-ММ'),
  /** '' — the plan for all channels together. */
  sourceId: z.string().trim().max(100).default(''),
  budget: amount.nullable().or(z.literal('').transform(() => null)),
  leads: count,
  qualifiedLeads: count,
  sales: count,
});
export type SavePlanInput = z.infer<typeof savePlanSchema>;

export const qualifiedStagesSchema = z.object({
  stages: z.array(z.string().trim().min(1).max(100)).max(200),
});
