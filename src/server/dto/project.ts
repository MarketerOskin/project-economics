import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Дата должна быть в формате ГГГГ-ММ-ДД')
  .transform((s) => new Date(s));

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const baseProjectShape = {
  name: z.string().trim().min(1, 'Укажите название проекта').max(200),
  description: optionalTrimmed(4000),
  clientName: optionalTrimmed(200),
  internalComment: optionalTrimmed(4000),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).default('ACTIVE'),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  memberIds: z.array(z.string().min(1)).max(100).default([]),
};

const endAfterStart = <T extends { startDate?: Date; endDate?: Date }>(v: T, ctx: z.RefinementCtx) => {
  if (v.startDate && v.endDate && v.endDate.getTime() < v.startDate.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'Дата окончания не может быть раньше даты начала',
    });
  }
};

export const createProjectSchema = z
  .object(baseProjectShape)
  .extend({
    source: z.enum(['MANUAL', 'BITRIX_CRM']).default('MANUAL'),
    crmEntityTypeId: z.number().int().optional(),
    crmEntityId: z.string().optional(),
  })
  .superRefine(endAfterStart);

export const updateProjectSchema = z
  .object({
    name: baseProjectShape.name.optional(),
    description: baseProjectShape.description,
    clientName: baseProjectShape.clientName,
    internalComment: baseProjectShape.internalComment,
    status: z.enum(['ACTIVE', 'COMPLETED']).optional(),
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (
      v.startDate &&
      v.endDate &&
      v.startDate instanceof Date &&
      v.endDate instanceof Date &&
      v.endDate.getTime() < v.startDate.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'Дата окончания не может быть раньше даты начала',
      });
    }
  });

export const setMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).max(100),
});

export const listProjectsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED', 'ALL']).default('ACTIVE'),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['name', 'income', 'expense', 'profit', 'margin']).default('profit'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  from: isoDate.optional(),
  to: isoDate.optional(),
  memberId: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
