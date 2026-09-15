import { z } from 'zod';

export const setPlanSchema = z.object({
  plan: z.enum(['FREE', 'PRO']),
  /** ISO date, or null/omitted for "no expiry". */
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Дата в формате ГГГГ-ММ-ДД')
    .transform((s) => new Date(s))
    .nullable()
    .optional(),
  note: z.string().trim().max(500).optional(),
});

export type SetPlanInput = z.infer<typeof setPlanSchema>;

export const setLeadStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'DECLINED']),
});
