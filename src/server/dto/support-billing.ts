import { z } from 'zod';

export const postSupportMonthSchema = z.object({
  projectId: z.string().min(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Месяц в формате ГГГГ-ММ'),
  incomeCategoryId: z.string().min(1, 'Выберите статью дохода'),
  expenseCategoryId: z.string().min(1, 'Выберите статью расхода'),
});
