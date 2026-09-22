import type { PortalInstallation } from '@prisma/client';
import { callBitrix } from './client';
import { ENTITY_TYPE_ID } from './types';

/**
 * Bitrix24's UF_CRM_TASK binding value for one CRM entity ("D_123" for a Deal, "T1068_7" for
 * a dynamic Smart Process item). NOT independently verified against a live portal for the
 * Smart Process case — task.elapseditem sync (ADR-027) is designed to fail soft (zero tasks
 * found, never a thrown error) specifically so a wrong prefix here degrades to "nothing to
 * sync yet" rather than breaking the nightly job for every other project.
 */
export function crmTaskBinding(entityTypeId: number, crmEntityId: string): string {
  if (entityTypeId === ENTITY_TYPE_ID.DEAL) return `D_${crmEntityId}`;
  if (entityTypeId === ENTITY_TYPE_ID.COMPANY) return `CO_${crmEntityId}`;
  return `T${entityTypeId}_${crmEntityId}`;
}

interface BitrixTaskListResult {
  tasks: Array<{ id: string | number }>;
}

/** Every Bitrix24 task bound to one CRM entity (tasks.task.list, UF_CRM_TASK filter). */
export async function listTaskIdsBoundToCrm(
  portal: PortalInstallation,
  entityTypeId: number,
  crmEntityId: string,
): Promise<number[]> {
  const binding = crmTaskBinding(entityTypeId, crmEntityId);
  const res = await callBitrix<BitrixTaskListResult>(portal, 'tasks.task.list', {
    filter: { UF_CRM_TASK: [binding] },
    select: ['ID'],
  });
  return (res?.tasks ?? []).map((t) => Number(t.id)).filter((id) => Number.isFinite(id));
}

export interface ElapsedTimeItem {
  bitrixUserId: string;
  workDate: string;
  hours: number;
}

interface BitrixElapsedItem {
  ID: string;
  USER_ID: string;
  CREATED_DATE: string;
  MINUTES?: string | number;
  SECONDS?: string | number;
}

/** Time logged against one task (task.elapseditem.getlist), one row per log entry. */
export async function listElapsedTime(
  portal: PortalInstallation,
  taskId: number,
): Promise<ElapsedTimeItem[]> {
  const res = await callBitrix<BitrixElapsedItem[]>(portal, 'task.elapseditem.getlist', { TASKID: taskId });
  return (res ?? []).map((item) => {
    const minutes = item.MINUTES !== undefined ? Number(item.MINUTES) : undefined;
    const seconds = item.SECONDS !== undefined ? Number(item.SECONDS) : undefined;
    const hours = minutes !== undefined ? minutes / 60 : seconds !== undefined ? seconds / 3600 : 0;
    return {
      bitrixUserId: String(item.USER_ID),
      workDate: item.CREATED_DATE.slice(0, 10),
      hours,
    };
  });
}
