import type { PortalInstallation } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withPortal } from '@/lib/db/with-portal';
import { effectivePlan } from '@/lib/billing/plan';
import { m } from '@/domain/finance';
import { getCrmItem } from '@/lib/bitrix/crm';

export interface SyncPortalIncomeResult {
  projectsSynced: number;
  draftsUpserted: number;
  errors: string[];
}

/**
 * Snapshots each CRM-imported project's current deal/item amount (opportunity) into a
 * CrmIncomeDraft — one row per project, re-opened to PENDING whenever the Bitrix24 amount
 * changes, even if a prior amount was already APPROVED/REJECTED (ADR-028): that decision was
 * about a different number. Never touched when the amount is unchanged, so a manager's review
 * state survives sync-to-sync until the deal itself moves.
 */
export async function syncPortalIncome(portal: PortalInstallation): Promise<SyncPortalIncomeResult> {
  const scope = withPortal(portal.id);
  const projects = await scope.project.findMany({
    where: { sourceType: 'BITRIX_CRM', status: { not: 'ARCHIVED' }, crmEntityTypeId: { not: null }, crmEntityId: { not: null } },
  });

  const result: SyncPortalIncomeResult = { projectsSynced: 0, draftsUpserted: 0, errors: [] };

  for (const project of projects) {
    try {
      const item = await getCrmItem(portal, project.crmEntityTypeId!, project.crmEntityId!);
      if (item.opportunity === null) {
        result.projectsSynced += 1;
        continue;
      }
      const crmAmount = m(item.opportunity).toDecimalPlaces(2);

      const existing = await db.crmIncomeDraft.findUnique({
        where: { portalId_projectId: { portalId: portal.id, projectId: project.id } },
      });
      if (existing?.crmAmount.equals(crmAmount)) {
        result.projectsSynced += 1;
        continue;
      }

      await scope.incomeDraft.upsert({
        where: { portalId_projectId: { portalId: portal.id, projectId: project.id } },
        create: { projectId: project.id, crmAmount, syncedAt: new Date(), status: 'PENDING' },
        update: { crmAmount, syncedAt: new Date(), status: 'PENDING' },
      });
      result.draftsUpserted += 1;
      result.projectsSynced += 1;
    } catch (err) {
      result.errors.push(`${project.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

/** Every portal eligible for the nightly income sync: connected, currently on PRO, not demo. */
export async function syncAllPortalsIncome(): Promise<Record<string, SyncPortalIncomeResult>> {
  const candidates = await db.portalInstallation.findMany({
    where: { isActive: true, isDemo: false, authTokenEnc: { not: null } },
  });
  const portals = candidates.filter((p) => effectivePlan(p) === 'PRO');

  const byPortal: Record<string, SyncPortalIncomeResult> = {};
  for (const portal of portals) {
    byPortal[portal.id] = await syncPortalIncome(portal);
  }
  return byPortal;
}
