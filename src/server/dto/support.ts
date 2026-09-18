import { z } from 'zod';

export const bugReportSchema = z.object({
  description: z.string().trim().min(5, 'Опишите проблему подробнее').max(2000),
  pageUrl: z.string().trim().max(500).optional(),
});

export type BugReportInput = z.infer<typeof bugReportSchema>;
