import { route } from '@/server/handler';
import { getTimeFields, putTimeField } from '@/server/api/time-fields';

export const dynamic = 'force-dynamic';

export const GET = route(getTimeFields);
export const PUT = route(putTimeField);
