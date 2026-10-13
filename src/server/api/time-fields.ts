import { can, requirePermission } from '@/lib/permissions';
import { badRequest } from '@/lib/errors';
import { saveTimeFieldSchema } from '@/server/dto/time-field';
import {
  getTimeFieldOptions,
  getTimeFieldSettings,
  saveTimeField,
} from '@/server/services/time-fields';
import type { HandlerContext } from '@/server/handler';

/** Where CRM types keep time spent (ADR-040): the current mappings and the types to map. */
export async function getTimeFields({ session, scope }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  return getTimeFieldSettings(session.portal, scope, session.demo);
}

export async function getTimeFieldFields({ req, session }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  const entityTypeId = Number(new URL(req.url).searchParams.get('entityTypeId'));
  if (!Number.isInteger(entityTypeId) || entityTypeId <= 0) throw badRequest('Не указан раздел');
  return getTimeFieldOptions(session.portal, entityTypeId);
}

export async function putTimeField({ req, session, scope }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  const input = saveTimeFieldSchema.parse(await req.json());
  await saveTimeField(session.portal, scope, input);
  return { ok: true };
}
