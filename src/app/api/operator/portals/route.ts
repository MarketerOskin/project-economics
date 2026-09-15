import { routeOperator } from '@/server/operator-handler';
import { listPortalsForOperator } from '@/server/services/operator';

export const dynamic = 'force-dynamic';

export const GET = routeOperator(async ({ req }) => {
  const search = new URL(req.url).searchParams.get('q') ?? undefined;
  return { portals: await listPortalsForOperator({ search }) };
});
