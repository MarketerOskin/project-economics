import { z } from 'zod';

export const saveStageRulesSchema = z.object({
  entityTypeId: z.number().int().positive(),
  rules: z
    .array(
      z.object({
        stageId: z.string().trim().min(1).max(100),
        outcome: z.enum(['PROCESS', 'CLOSED', 'SUCCESS', 'CANCELLED']),
      }),
    )
    .max(500),
});
