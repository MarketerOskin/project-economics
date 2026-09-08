import { z } from 'zod';
import { route } from '@/server/handler';
import { browseCrm } from '@/server/services/crm';
import { can, requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const q = z.object({
  entityTypeId: z.coerce.number().int().refine((n) => n === 2 || n === 4, 'Только сделки (2) и компании (4)'),
  q: z.string().trim().max(200).optional(),
});

export const GET = route(async ({ req, session }) => {
  requirePermission(can.mutateProject(session.actor));
  const { entityTypeId, q: search } = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  return { items: await browseCrm(session, entityTypeId, search) };
});
