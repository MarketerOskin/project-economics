import { route } from '@/server/handler';
import { getIncomeDrafts } from '@/server/api/crm-income-drafts';

export const dynamic = 'force-dynamic';

export const GET = route(getIncomeDrafts);
