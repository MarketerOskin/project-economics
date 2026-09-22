import { can, requirePermission } from '@/lib/permissions';
import { approveTimeDraftSchema } from '@/server/dto/time-draft';
import { approveTimeDraft, listPendingDrafts, rejectTimeDraft } from '@/server/services/time-drafts';
import type { HandlerContext } from '@/server/handler';

export async function getTimeDrafts({ session, scope }: HandlerContext) {
  requirePermission(can.mutateFinance(session.actor));
  return { drafts: await listPendingDrafts(scope) };
}

export async function postApproveTimeDraft({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateFinance(session.actor));
  const { categoryId } = approveTimeDraftSchema.parse(await req.json());
  const { entryId } = await approveTimeDraft(scope, session, params.id, categoryId);
  return { entryId };
}

export async function postRejectTimeDraft({ params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateFinance(session.actor));
  await rejectTimeDraft(scope, session, params.id);
  return { ok: true };
}
