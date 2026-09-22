import { z } from 'zod';

export const addCrmSourceSchema = z.object({
  entityTypeId: z.number().int().min(1000, 'Это не смарт-процесс'),
});

export type AddCrmSourceInput = z.infer<typeof addCrmSourceSchema>;
