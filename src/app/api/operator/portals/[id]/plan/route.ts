import { routeOperator } from '@/server/operator-handler';
import { setPlanSchema } from '@/server/dto/operator';
import { getPortalGrantHistory, setPortalPlan } from '@/server/services/operator';

export const dynamic = 'force-dynamic';

export const PATCH = routeOperator<{ id: string }>(async ({ req, params, operatorEmail }) => {
  const input = setPlanSchema.parse(await req.json());
  await setPortalPlan({
    portalId: params.id,
    plan: input.plan,
    expiresAt: input.expiresAt ?? null,
    note: input.note ?? null,
    operatorEmail,
  });
  return { ok: true };
});

export const GET = routeOperator<{ id: string }>(async ({ params }) => {
  return { history: await getPortalGrantHistory(params.id) };
});
