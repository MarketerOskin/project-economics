import { db } from '@/lib/db/client';

/**
 * Erases everything stored for a portal, including the portal record itself. Used when the
 * user removes the app with "Очистить данные приложения" ticked (ONAPPUNINSTALL data[CLEAN]=1)
 * — the Marketplace expects no portal data left behind after such an uninstall.
 * Explicit, ordered deletes in one transaction: FinancialEntry -> FinanceCategory is
 * ON DELETE RESTRICT, so a bare cascade from the portal row can't be relied on.
 */
export async function purgePortalData(portalId: string): Promise<void> {
  await db.$transaction([
    db.auditLog.deleteMany({ where: { portalId } }),
    db.financialEntry.deleteMany({ where: { portalId } }),
    db.projectMember.deleteMany({ where: { portalId } }),
    db.project.deleteMany({ where: { portalId } }),
    db.financeCategory.deleteMany({ where: { portalId } }),
    db.proLead.deleteMany({ where: { portalId } }),
    db.operatorGrant.deleteMany({ where: { portalId } }),
    db.apiCallLog.deleteMany({ where: { portalId } }),
    db.appUser.deleteMany({ where: { portalId } }),
    db.portalInstallation.delete({ where: { id: portalId } }),
  ]);
}
