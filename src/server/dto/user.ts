import { z } from 'zod';

export const updateUserSchema = z.object({
  hourlyRate: z.number().min(0).max(1_000_000).nullable(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
