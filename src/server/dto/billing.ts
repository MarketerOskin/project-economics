import { z } from 'zod';

export const createProLeadSchema = z.object({
  contact: z.string().trim().min(3, 'Оставьте email, телефон или Telegram').max(200),
  comment: z.string().trim().max(1000).optional(),
});

export type CreateProLeadInput = z.infer<typeof createProLeadSchema>;
