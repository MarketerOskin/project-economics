import type { PortalInstallation } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import { listSmartProcessTypes } from '@/lib/bitrix/crm';
import { listItemFields, type ItemField, type TimeFieldMap } from '@/lib/bitrix/related';
import { ENTITY_TYPE_ID } from '@/lib/bitrix/types';
import { badRequest } from '@/lib/errors';
import type { SaveTimeFieldInput } from '@/server/dto/time-field';
import { invalidateAnalytics } from './analytics';
import { invalidateRelated } from './related';

/**
 * Where each CRM type keeps time spent on an item (ADR-040). Task time tracking stays the
 * default source; a mapping adds the time written into a type's own fields — «Заявки BK»
 * keeps hours and minutes in two fields — for elements linked to a project.
 */

/** Field types that can hold hours or minutes. */
const NUMERIC_TYPES = new Set(['double', 'integer', 'string']);
const USER_TYPES = new Set(['employee', 'user']);

export interface TimeFieldRow extends TimeFieldMap {
  entityTypeId: number;
  label: string;
}

/** Deals plus every smart process: the types an element linked to a project can be. */
export async function listTimeSourceTypes(
  portal: PortalInstallation,
): Promise<Array<{ entityTypeId: number; title: string }>> {
  const smart = await listSmartProcessTypes(portal);
  return [
    { entityTypeId: ENTITY_TYPE_ID.DEAL, title: 'Сделки' },
    ...smart.map((t) => ({ entityTypeId: t.entityTypeId, title: t.title })),
  ];
}

export async function getTimeFieldSettings(
  portal: PortalInstallation,
  scope: PortalScope,
  demo: boolean,
) {
  const rows = await scope.crmTimeField.findMany();
  const mappings: TimeFieldRow[] = rows.map((r) => ({
    entityTypeId: r.entityTypeId,
    label: r.label,
    hoursField: r.hoursField,
    minutesField: r.minutesField,
    userField: r.userField,
  }));
  if (demo) return { types: [], mappings, error: null as string | null };
  try {
    return { types: await listTimeSourceTypes(portal), mappings, error: null as string | null };
  } catch (err) {
    return { types: [], mappings, error: err instanceof Error ? err.message : String(err) };
  }
}

/** The fields of one type that can hold time, and the ones that can hold an employee. */
export async function getTimeFieldOptions(portal: PortalInstallation, entityTypeId: number) {
  const fields = await listItemFields(portal, entityTypeId);
  return {
    numeric: fields.filter((f) => NUMERIC_TYPES.has(f.type) && f.name !== 'title'),
    users: fields.filter((f) => USER_TYPES.has(f.type) && f.name !== 'assignedById'),
  };
}

function check(fields: ItemField[], name: string | null, allowed: Set<string>, what: string) {
  if (name === null) return;
  const f = fields.find((x) => x.name === name);
  if (!f || !allowed.has(f.type)) throw badRequest(`Поле для ${what} не найдено в Битрикс24`);
}

export async function saveTimeField(
  portal: PortalInstallation,
  scope: PortalScope,
  input: SaveTimeFieldInput,
) {
  const { entityTypeId, hoursField, minutesField, userField } = input;
  if (!hoursField && !minutesField) {
    await scope.crmTimeField.remove(entityTypeId);
  } else {
    const types = await listTimeSourceTypes(portal);
    const type = types.find((t) => t.entityTypeId === entityTypeId);
    if (!type) throw badRequest('Такого раздела нет в Битрикс24');
    const fields = await listItemFields(portal, entityTypeId);
    check(fields, hoursField, NUMERIC_TYPES, 'часов');
    check(fields, minutesField, NUMERIC_TYPES, 'минут');
    check(fields, userField, USER_TYPES, 'сотрудника');
    await scope.crmTimeField.upsert(entityTypeId, {
      label: type.title,
      hoursField,
      minutesField,
      userField,
    });
  }
  invalidateAnalytics(portal.id);
  invalidateRelated(portal.id);
}
