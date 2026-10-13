import { route } from '@/server/handler';
import { suggestBrand } from '@/server/api/brand';

export const dynamic = 'force-dynamic';

/** POST: reading the portal's CRM costs REST calls, so it is an explicit action. */
export const POST = route(suggestBrand);
