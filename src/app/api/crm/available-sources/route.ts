import { route } from '@/server/handler';
import { getAvailableSources } from '@/server/api/crm-sources';

export const dynamic = 'force-dynamic';

export const GET = route(getAvailableSources);
