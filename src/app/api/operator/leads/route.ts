import { routeOperator } from '@/server/operator-handler';
import { listProLeadsForOperator } from '@/server/services/operator';

export const dynamic = 'force-dynamic';

export const GET = routeOperator(async ({ req }) => {
  const status = new URL(req.url).searchParams.get('status');
  const validStatus = status === 'NEW' || status === 'CONTACTED' || status === 'CONVERTED' || status === 'DECLINED' ? status : undefined;
  return { leads: await listProLeadsForOperator({ status: validStatus }) };
});
