import { route } from '@/server/handler';
import { putPlan } from '@/server/api/marketing';

export const dynamic = 'force-dynamic';

export const PUT = route(putPlan);
