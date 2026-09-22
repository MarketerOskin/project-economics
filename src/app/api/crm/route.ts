import { z } from 'zod';
import { route } from '@/server/handler';
import { browseCrm } from '@/server/services/crm';
import { listImportSources } from '@/server/services/crm-sources';
import { can, requirePermission } from '@/lib/permissions';
import { badRequest } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const q = z.object({
  entityTypeId: z.coerce.number().int(),
  q: z.string().trim().max(200).optional(),
});

export const GET = route(async ({ req, session, scope }) => {
  requirePermission(can.mutateProject(session.actor));
  const { entityTypeId, q: search } = q.parse(Object.fromEntries(new URL(req.url).searchParams));

  // Deal/Company are always allowed; anything else must be a source the admin configured
  // (ADR-026) — never an arbitrary entityTypeId the client happens to send.
  const sources = await listImportSources(scope);
  if (!sources.some((s) => s.entityTypeId === entityTypeId)) {
    throw badRequest('Этот тип CRM-сущности не настроен как источник проектов');
  }

  return { items: await browseCrm(session, entityTypeId, search) };
});
