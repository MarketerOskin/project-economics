import { db } from '@/lib/db/client';
import { withPortal } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { can, requirePermission } from '@/lib/permissions';
import { requirePro } from '@/lib/billing/plan';
import { linkBitrixSchema } from '@/server/dto/project';
import { resolveBitrixSource } from '@/server/services/bitrix-source';
import { invalidateAnalytics } from '@/server/services/analytics';
import type { HandlerContext } from '@/server/handler';

/**
 * POST /api/projects/:id/bitrix-link — attach a project made by hand (or re-attach one) to a
 * Bitrix24 deal, company, smart-process item or «Проекты» group, so its tasks, hours and
 * meetings reach «Аналитика» (ADR-035). Finances and the team are untouched.
 */
export async function linkProjectToBitrix({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateProject(session.actor));
  requirePro(session.plan, 'Связь проекта с Битрикс24');
  const existing = await scope.project.findByIdOrThrow(params.id);
  const input = linkBitrixSchema.parse(await req.json());
  const found = await resolveBitrixSource(session, scope, input);
  const { portal, user } = session;

  const before = {
    sourceType: existing.sourceType,
    crmEntityTypeId: existing.crmEntityTypeId,
    crmEntityId: existing.crmEntityId,
    crmEntityTitle: existing.crmEntityTitle,
  };
  const after = {
    sourceType: input.source,
    crmEntityTypeId: input.source === 'BITRIX_CRM' ? input.crmEntityTypeId : null,
    crmEntityId: found.crmEntityId,
    crmEntityTitle: found.crmEntityTitle,
  };

  await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    await p.project.update(existing.id, {
      ...after,
      crmEntityType: found.crmEntityType,
      crmEntityUrl: found.crmEntityUrl,
      // Keep a client name the user typed; fill it from the deal only when it was empty.
      ...(existing.clientName ? {} : { clientName: found.clientName }),
      updatedById: user.id,
    });
    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: `${user.firstName} ${user.lastName}`.trim() },
      action: 'PROJECT_UPDATED',
      entityType: 'PROJECT',
      entityId: existing.id,
      projectId: existing.id,
      before,
      after,
    });
  });
  invalidateAnalytics(portal.id, existing.id);

  return { ok: true, title: found.crmEntityTitle };
}
