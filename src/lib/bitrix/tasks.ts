import type { PortalInstallation } from '@prisma/client';
import { callBitrix } from './client';
import { ENTITY_TYPE_ID } from './types';

/**
 * Bitrix24's UF_CRM_TASK binding value for one CRM entity: "D_123" for a Deal, "CO_5" for a
 * Company, and for a Smart Process "T" + entityTypeId in lowercase hex ("T8a_7" for
 * entityTypeId 138) — Bitrix's CCrmOwnerTypeAbbr for dynamic types (ADR-036).
 */
export function crmTaskBinding(entityTypeId: number, crmEntityId: string): string {
  if (entityTypeId === ENTITY_TYPE_ID.DEAL) return `D_${crmEntityId}`;
  if (entityTypeId === ENTITY_TYPE_ID.COMPANY) return `CO_${crmEntityId}`;
  return `T${entityTypeId.toString(16)}_${crmEntityId}`;
}

/**
 * Every UF_CRM_TASK value to filter by. Smart Processes also get the decimal form this app
 * used before ADR-036: it can't match a hex binding, so it costs nothing and covers a portal
 * that turns out to write it that way.
 */
export function crmTaskBindings(entityTypeId: number, crmEntityId: string): string[] {
  const hex = crmTaskBinding(entityTypeId, crmEntityId);
  const dec = `T${entityTypeId}_${crmEntityId}`;
  return hex.startsWith('T') && hex !== dec ? [hex, dec] : [hex];
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
  const res = await callBitrix<BitrixTaskListResult>(portal, 'tasks.task.list', {
    filter: { UF_CRM_TASK: crmTaskBindings(entityTypeId, crmEntityId) },
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
