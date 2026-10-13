import { route } from '@/server/handler';
import { can, requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * Bitrix24 entities that already have a project (archived ones too), so bulk import can mark
 * them instead of creating duplicates. Keys: "crm:<entityTypeId>:<id>" and "group:<id>".
 */
export const GET = route(async ({ session, scope }) => {
  requirePermission(can.mutateProject(session.actor));
  const rows = await scope.project.findMany({
    where: { sourceType: { in: ['BITRIX_CRM', 'BITRIX_PROJECT'] }, crmEntityId: { not: null } },
    select: { sourceType: true, crmEntityTypeId: true, crmEntityId: true },
  });
  return {
    keys: rows.map((r) => (r.sourceType === 'BITRIX_PROJECT' ? `group:${r.crmEntityId}` : `crm:${r.crmEntityTypeId}:${r.crmEntityId}`)),
  };
});
