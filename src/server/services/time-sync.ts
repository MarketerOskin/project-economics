import type { PortalInstallation } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withPortal } from '@/lib/db/with-portal';
import { effectivePlan } from '@/lib/billing/plan';
import { listElapsedTime, listTaskIdsBoundToCrm } from '@/lib/bitrix/tasks';

/** How far back to look for newly-logged time each night — catches backdated entries. */
const SYNC_WINDOW_DAYS = 60;

export interface SyncPortalResult {
  projectsSynced: number;
  draftsUpserted: number;
  errors: string[];
}

function windowStart(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - SYNC_WINDOW_DAYS);
  return d;
}

/**
 * Aggregates Bitrix24 task time (bound to each CRM-imported project's CRM entity) into
 * TaskTimeDraft rows, one per (project, employee, day). Only PENDING/REJECTED drafts are
 * touched — an APPROVED draft already became a real FinancialEntry and must never be
 * silently changed underneath it (ADR-027).
 */
export async function syncPortalHours(portal: PortalInstallation): Promise<SyncPortalResult> {
  const scope = withPortal(portal.id);
  const cutoff = windowStart();

  const [projects, employees] = await Promise.all([
    scope.project.findMany({
      where: { sourceType: 'BITRIX_CRM', status: { not: 'ARCHIVED' }, crmEntityTypeId: { not: null }, crmEntityId: { not: null } },
    }),
    scope.user.findMany({ where: { isActive: true } }),
  ]);
  const employeeByBitrixId = new Map(employees.map((e) => [e.bitrixUserId, e]));

  const result: SyncPortalResult = { projectsSynced: 0, draftsUpserted: 0, errors: [] };

  for (const project of projects) {
    try {
      const taskIds = await listTaskIdsBoundToCrm(portal, project.crmEntityTypeId!, project.crmEntityId!);

      // (employeeId, isoDate) -> total hours logged in the sync window.
      const totals = new Map<string, { employeeId: string; workDate: string; hours: number; taskIds: Set<number> }>();
      for (const taskId of taskIds) {
        const items = await listElapsedTime(portal, taskId);
        for (const item of items) {
          if (item.hours <= 0 || new Date(item.workDate) < cutoff) continue;
          const employee = employeeByBitrixId.get(item.bitrixUserId);
          if (!employee) continue;
          const key = `${employee.id}:${item.workDate}`;
          const bucket = totals.get(key) ?? { employeeId: employee.id, workDate: item.workDate, hours: 0, taskIds: new Set<number>() };
          bucket.hours += item.hours;
          bucket.taskIds.add(taskId);
          totals.set(key, bucket);
        }
      }

      for (const { employeeId, workDate, hours, taskIds: contributingTasks } of totals.values()) {
        const existing = await db.taskTimeDraft.findUnique({
          where: {
            portalId_projectId_employeeId_workDate: {
              portalId: portal.id,
              projectId: project.id,
              employeeId,
              workDate: new Date(workDate),
            },
          },
        });
        if (existing?.status === 'APPROVED') continue;

        await scope.timeDraft.upsert({
          where: {
            portalId_projectId_employeeId_workDate: {
              portalId: portal.id,
              projectId: project.id,
              employeeId,
              workDate: new Date(workDate),
            },
          },
          create: {
            projectId: project.id,
            employeeId,
            workDate: new Date(workDate),
            hours: hours.toFixed(2),
            bitrixTaskIds: [...contributingTasks],
            status: 'PENDING',
          },
          update: {
            hours: hours.toFixed(2),
            bitrixTaskIds: [...contributingTasks],
            status: 'PENDING',
          },
        });
        result.draftsUpserted += 1;
      }

      result.projectsSynced += 1;
    } catch (err) {
      result.errors.push(`${project.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

/** Every portal eligible for the nightly sync: connected, currently on PRO, not demo (ADR-027). */
export async function syncAllPortals(): Promise<Record<string, SyncPortalResult>> {
  const candidates = await db.portalInstallation.findMany({
    where: { isActive: true, isDemo: false, authTokenEnc: { not: null } },
  });
  const portals = candidates.filter((p) => effectivePlan(p) === 'PRO');

  const byPortal: Record<string, SyncPortalResult> = {};
  for (const portal of portals) {
    byPortal[portal.id] = await syncPortalHours(portal);
  }
  return byPortal;
}
