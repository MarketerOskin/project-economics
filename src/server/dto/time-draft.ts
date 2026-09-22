import { z } from 'zod';

export const approveTimeDraftSchema = z.object({
  categoryId: z.string().min(1, 'Выберите статью расхода'),
});

export type ApproveTimeDraftInput = z.infer<typeof approveTimeDraftSchema>;
