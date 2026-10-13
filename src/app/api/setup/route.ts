import { route } from '@/server/handler';
import { getPortalSetup, putPortalSetup } from '@/server/api/setup';

export const dynamic = 'force-dynamic';

export const GET = route(getPortalSetup);
export const PUT = route(putPortalSetup);
