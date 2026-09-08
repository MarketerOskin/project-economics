import { z } from 'zod';
import { m } from '@/domain/finance/money';

/** A positive decimal amount as a string ("125000", "125000.50"). Kept as string for Decimal. */
const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((s) => /^-?\d+(\.\d+)?$/.test(s), 'Введите число')
  .refine((s) => {
    try {
      return m(s).isFinite();
    } catch {
      return false;
    }
  }, 'Некорректная сумма');

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Дата в формате ГГГГ-ММ-ДД')
  .transform((s) => new Date(s));

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const baseEntry = z.object({
  projectId: z.string().min(1, 'Выберите проект'),
  categoryId: z.string().min(1, 'Выберите статью'),
  direction: z.enum(['INCOME', 'EXPENSE']),
  budgetType: z.enum(['PLAN', 'FACT']),
  operationDate: isoDate,
  calculationMode: z.enum(['FIXED', 'HOURS_RATE']).default('FIXED'),
  amount: decimalString.optional(),
  hours: decimalString.optional(),
  hourlyRate: decimalString.optional(),
  employeeId: z.string().optional(),
  contractorName: optional(200),
  counterpartyName: optional(200),
  invoiceNumber: optional(120),
  invoiceDate: isoDate.optional(),
  documentUrl: z.string().trim().url('Некорректная ссылка').max(2000).optional().or(z.literal('').transform(() => undefined)),
  description: optional(2000),
  comment: optional(2000),
  plannedEntryId: z.string().optional(),
});

/** Parse to Decimal, or null if not a valid number string (field-level refine already flags it). */
function safeM(s: string | undefined) {
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  try {
    return m(s);
  } catch {
    return null;
  }
}

/** ТЗ §51: amount > 0; hours > 0; rate >= 0; HOURS_RATE requires hours+rate; FIXED ignores them. */
function enforceMode(v: z.infer<typeof baseEntry>, ctx: z.RefinementCtx) {
  if (v.calculationMode === 'HOURS_RATE') {
    const hours = safeM(v.hours);
    const rate = safeM(v.hourlyRate);
    if (!hours || hours.lte(0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hours'], message: 'Укажите количество часов больше 0' });
    }
    if (!rate || rate.lt(0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hourlyRate'], message: 'Укажите ставку (0 или больше)' });
    }
  } else {
    const amount = safeM(v.amount);
    if (!amount || amount.lte(0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Введите сумму больше 0' });
    }
  }
  if (v.direction === 'INCOME' && v.calculationMode === 'HOURS_RATE') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['calculationMode'], message: 'Часы × ставка доступны только для расходов' });
  }
}

export const createEntrySchema = baseEntry.superRefine(enforceMode);

export const updateEntrySchema = baseEntry
  .partial({
    projectId: true,
    direction: true,
    budgetType: true,
    operationDate: true,
    categoryId: true,
  })
  .superRefine((v, ctx) => {
    // Only validate mode consistency when the mode-relevant fields are present.
    if (v.calculationMode) enforceMode(v as z.infer<typeof baseEntry>, ctx);
  });

export const listEntriesQuerySchema = z.object({
  projectId: z.string().optional(),
  direction: z.enum(['INCOME', 'EXPENSE']).optional(),
  budgetType: z.enum(['PLAN', 'FACT']).optional(),
  categoryId: z.string().optional(),
  employeeId: z.string().optional(),
  authorId: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  includeDeleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((s) => s === 'true'),
  sort: z.enum(['date', 'amount', 'project']).default('date'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;
