import { z } from 'zod';
import { route } from '@/server/handler';
import { queryAudit } from '@/server/services/audit-read';

export const dynamic = 'force-dynamic';

const q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  actorId: z.string().optional(),
  projectId: z.string().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const GET = route(async ({ req, session, scope }) => {
  const parsed = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  return queryAudit(scope, session.actor, {
    ...parsed,
    from: parsed.from ? new Date(parsed.from) : undefined,
    to: parsed.to ? new Date(parsed.to) : undefined,
  });
});
