import { z } from 'zod';

export const createProLeadSchema = z.object({
  contact: z.string().trim().min(3, 'Оставьте email, телефон или Telegram').max(200),
  comment: z.string().trim().max(2000).optional(),
  kind: z.enum(['PRO', 'IMPLEMENTATION']).default('PRO'),
});

export type CreateProLeadInput = z.infer<typeof createProLeadSchema>;
