import { can, requirePermission } from '@/lib/permissions';
import { addCrmSourceSchema } from '@/server/dto/crm-source';
import {
  addImportSource,
  listAddableSmartProcesses,
  listImportSources,
  removeImportSource,
} from '@/server/services/crm-sources';
import type { HandlerContext } from '@/server/handler';

export async function getImportSources({ session, scope }: HandlerContext) {
  requirePermission(can.mutateProject(session.actor));
  return { sources: await listImportSources(scope) };
}

export async function getAddableSmartProcesses({ session, scope }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  return { types: await listAddableSmartProcesses(session.portal, scope) };
}

export async function postImportSource({ req, session, scope }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  const { entityTypeId } = addCrmSourceSchema.parse(await req.json());
  const created = await addImportSource(session.portal, scope, entityTypeId);
  return Response.json({ id: created.id }, { status: 201 });
}

export async function deleteImportSource({ params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.manageSettings(session.actor));
  await removeImportSource(scope, params.id);
  return { ok: true };
}
