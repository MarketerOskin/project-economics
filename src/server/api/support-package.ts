import { db } from '@/lib/db/client';
import { withPortal } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { can, requirePermission } from '@/lib/permissions';
import { requirePro } from '@/lib/billing/plan';
import { supportPackageSchema } from '@/server/dto/support-package';
import type { HandlerContext } from '@/server/handler';

/** PATCH /api/projects/:id/support-package — monthly hours, fee and overage rate (ADR-034). */
export async function updateSupportPackage({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateProject(session.actor));
  requirePro(session.plan, 'Аналитика задач, часов и встреч');
  const existing = await scope.project.findByIdOrThrow(params.id);
  const input = supportPackageSchema.parse(await req.json());
  const { portal, user } = session;

  const before = {
    supportHoursLimit: existing.supportHoursLimit?.toString() ?? null,
    supportMonthlyFee: existing.supportMonthlyFee?.toString() ?? null,
    supportHourRate: existing.supportHourRate?.toString() ?? null,
  };

  await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const updated = await p.project.update(existing.id, {
      supportHoursLimit: input.hoursLimit,
      supportMonthlyFee: input.monthlyFee,
      supportHourRate: input.hourRate,
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
      after: {
        supportHoursLimit: updated.supportHoursLimit?.toString() ?? null,
        supportMonthlyFee: updated.supportMonthlyFee?.toString() ?? null,
        supportHourRate: updated.supportHourRate?.toString() ?? null,
      },
    });
  });

  return { ok: true };
}
