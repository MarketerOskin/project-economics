import { routeOperator } from '@/server/operator-handler';
import { getOperatorOverview } from '@/server/services/operator';

export const dynamic = 'force-dynamic';

export const GET = routeOperator(async () => getOperatorOverview());
