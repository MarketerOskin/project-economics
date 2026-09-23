import { z } from 'zod';

export const approveIncomeDraftSchema = z.object({
  categoryId: z.string().min(1, 'Выберите статью дохода'),
});

export type ApproveIncomeDraftInput = z.infer<typeof approveIncomeDraftSchema>;
