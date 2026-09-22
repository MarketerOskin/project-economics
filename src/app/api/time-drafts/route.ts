import { route } from '@/server/handler';
import { getTimeDrafts } from '@/server/api/time-drafts';

export const dynamic = 'force-dynamic';

export const GET = route(getTimeDrafts);
