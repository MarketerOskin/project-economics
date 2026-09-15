import { route } from '@/server/handler';
import { db } from '@/lib/db/client';
import { can, requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** Hide the dashboard onboarding checklist for this portal. */
export const POST = route(async ({ session }) => {
  requirePermission(can.mutateProject(session.actor));
  await db.portalInstallation.update({
    where: { id: session.portal.id },
    data: { onboardingDismissedAt: new Date() },
  });
  return { ok: true };
});
