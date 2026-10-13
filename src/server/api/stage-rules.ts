import { can, requirePermission } from '@/lib/permissions';
import { saveStageRulesSchema } from '@/server/dto/stage-rules';
import { saveStageRules, stageSettings } from '@/server/services/stage-rules';
import { invalidateAnalytics } from '@/server/services/analytics';
import { invalidateMarketing } from '@/server/services/marketing';
import { invalidateRelated } from '@/server/services/related';
import type { HandlerContext } from '@/server/handler';

/** CRM stages and how each counts (ADR-051). */
export async function getStageRules({ session, scope }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  return { sections: await stageSettings(session.portal, scope, session.demo) };
}

export async function putStageRules({ req, session, scope }: HandlerContext) {
  requirePermission(can.manageSettings(session.actor));
  const input = saveStageRulesSchema.parse(await req.json());
  await saveStageRules(scope, input.entityTypeId, input.rules);
  invalidateAnalytics(session.portal.id);
  invalidateMarketing(session.portal.id);
  invalidateRelated(session.portal.id);
  return { ok: true };
}
