import { can, requirePermission } from '@/lib/permissions';
import { saveSetupSchema } from '@/server/dto/setup';
import { getSetup, saveSetup } from '@/server/services/portal-setup';
import type { HandlerContext } from '@/server/handler';

/** «Настройка под портал» (ADR-041). */
export async function getPortalSetup({ session, scope }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  return getSetup(session.portal, scope, session.demo);
}

export async function putPortalSetup({ req, session, scope }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  const input = saveSetupSchema.parse(await req.json());
  await saveSetup(session.portal, scope, session.demo, input);
  return { ok: true };
}
