import { routeOperator } from '@/server/operator-handler';
import { setLeadStatusSchema } from '@/server/dto/operator';
import { setLeadStatus } from '@/server/services/operator';

export const dynamic = 'force-dynamic';

export const PATCH = routeOperator<{ id: string }>(async ({ req, params, operatorEmail }) => {
  const input = setLeadStatusSchema.parse(await req.json());
  await setLeadStatus({ leadId: params.id, status: input.status, operatorEmail });
  return { ok: true };
});
