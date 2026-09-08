import { z } from 'zod';
import { CATEGORY_COLORS } from '@/lib/categories/palette';

export const createCategorySchema = z.object({
  kind: z.enum(['INCOME', 'EXPENSE']),
  name: z.string().trim().min(1, 'Укажите название').max(120),
  accentColor: z.enum(CATEGORY_COLORS as [string, ...string[]]).default('graphite'),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    accentColor: z.enum(CATEGORY_COLORS as [string, ...string[]]).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Нет изменений');

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
