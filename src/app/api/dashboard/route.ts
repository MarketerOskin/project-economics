import { z } from 'zod';
import { route } from '@/server/handler';
import { loadDashboard } from '@/server/services/dashboard';
import { resolvePeriod, type PeriodPreset } from '@/lib/period';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  preset: z
    .enum(['this_month', 'last_month', 'this_quarter', 'this_year', 'all_time', 'custom'])
    .default('this_year'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  projectId: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED', 'ALL']).optional(),
  employeeId: z.string().optional(),
  categoryId: z.string().optional(),
});

export const GET = route(async ({ req, session, scope }) => {
  const q = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const period = resolvePeriod(q.preset as PeriodPreset, {
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
  });
  return loadDashboard(scope, session.actor, {
    from: period.from,
    to: period.to,
    projectId: q.projectId,
    status: q.status,
    employeeId: q.employeeId,
    categoryId: q.categoryId,
  });
});
