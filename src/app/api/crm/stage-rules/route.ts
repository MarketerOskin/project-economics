import { route } from '@/server/handler';
import { getStageRules, putStageRules } from '@/server/api/stage-rules';

export const dynamic = 'force-dynamic';

export const GET = route(getStageRules);
export const PUT = route(putStageRules);
