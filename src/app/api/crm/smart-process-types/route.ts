import { route } from '@/server/handler';
import { getAddableSmartProcesses } from '@/server/api/crm-sources';

export const dynamic = 'force-dynamic';

export const GET = route(getAddableSmartProcesses);
