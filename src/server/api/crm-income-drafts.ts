import { can, requirePermission } from '@/lib/permissions';
import { approveIncomeDraftSchema } from '@/server/dto/crm-income-draft';
import { approveIncomeDraft, listPendingIncomeDrafts, rejectIncomeDraft } from '@/server/services/crm-income-drafts';
import type { HandlerContext } from '@/server/handler';

export async function getIncomeDrafts({ session, scope }: HandlerContext) {
  requirePermission(can.mutateFinance(session.actor));
  return { drafts: await listPendingIncomeDrafts(scope) };
}

export async function postApproveIncomeDraft({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateFinance(session.actor));
  const { categoryId } = approveIncomeDraftSchema.parse(await req.json());
  const { entryId } = await approveIncomeDraft(scope, session, params.id, categoryId);
  return { entryId };
}

export async function postRejectIncomeDraft({ params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateFinance(session.actor));
  await rejectIncomeDraft(scope, session, params.id);
  return { ok: true };
}
