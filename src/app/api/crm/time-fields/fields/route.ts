import { route } from '@/server/handler';
import { getTimeFieldFields } from '@/server/api/time-fields';

export const dynamic = 'force-dynamic';

export const GET = route(getTimeFieldFields);
