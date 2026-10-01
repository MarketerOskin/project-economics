import { z } from 'zod';
import { route } from '@/server/handler';
import { browseBitrixProjectGroups } from '@/server/services/bitrix-groups';
import { can, requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const q = z.object({ q: z.string().trim().max(200).optional() });

export const GET = route(async ({ req, session }) => {
  requirePermission(can.mutateProject(session.actor));
  const { q: search } = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  return { items: await browseBitrixProjectGroups(session, search) };
});
