import { route } from '@/server/handler';
import { getLogo } from '@/server/api/brand';

export const dynamic = 'force-dynamic';

export const GET = route(getLogo);
