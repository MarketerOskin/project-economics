import { z } from 'zod';

const fieldName = z
  .string()
  .trim()
  .max(100)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Некорректное поле')
  .nullable();

export const saveTimeFieldSchema = z.object({
  entityTypeId: z.number().int().positive(),
  hoursField: fieldName,
  minutesField: fieldName,
  userField: fieldName,
});

export type SaveTimeFieldInput = z.infer<typeof saveTimeFieldSchema>;
