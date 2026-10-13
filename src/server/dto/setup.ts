import { z } from 'zod';
import { SECTION_KEYS } from '@/lib/sections';

export const saveSetupSchema = z.object({
  roles: z
    .array(
      z.object({
        entityTypeId: z.number().int().positive(),
        role: z.enum(['TRAFFIC', 'SALES', 'SUPPORT', 'PROJECTS', 'IGNORE']),
      }),
    )
    .max(200),
  disabledSections: z.array(z.enum(SECTION_KEYS as [string, ...string[]])).max(SECTION_KEYS.length),
});

export type SaveSetupInput = z.infer<typeof saveSetupSchema>;
