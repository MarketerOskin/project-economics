import { can, requirePermission } from '@/lib/permissions';
import { badRequest } from '@/lib/errors';
import { postSupportMonthSchema } from '@/server/dto/support-billing';
import { listSupportBilling, postSupportMonth } from '@/server/services/support-billing';
import type { HandlerContext } from '@/server/handler';

function requirePro(plan: string) {
  if (plan !== 'PRO') throw badRequest('Авторасчёт по часам доступен на тарифе Pro');
}

export async function getSupportBilling({ session, scope }: HandlerContext) {
  requirePermission(can.mutateFinance(session.actor));
  requirePro(session.plan);
  return { months: await listSupportBilling(session, scope) };
}

export async function postSupportBilling({ req, session, scope }: HandlerContext) {
  requirePermission(can.mutateFinance(session.actor));
  requirePro(session.plan);
  const input = postSupportMonthSchema.parse(await req.json());
  return postSupportMonth(session, scope, input);
}
