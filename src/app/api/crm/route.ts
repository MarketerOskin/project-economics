import { z } from 'zod';
import { route } from '@/server/handler';
import { browseCrm } from '@/server/services/crm';
import { assertImportableSource } from '@/server/services/crm-sources';
import { can, requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const q = z.object({
  entityTypeId: z.coerce.number().int(),
  q: z.string().trim().max(200).optional(),
});

export const GET = route(async ({ req, session, scope }) => {
  requirePermission(can.mutateProject(session.actor));
  const { entityTypeId, q: search } = q.parse(Object.fromEntries(new URL(req.url).searchParams));

  // Deal/Company and the portal's real Smart Processes (ADR-036) — never an arbitrary
  // entityTypeId the client happens to send.
  await assertImportableSource(session, scope, entityTypeId);

  return { items: await browseCrm(session, entityTypeId, search) };
});
