import { route } from '@/server/handler';
import { postSupportBilling } from '@/server/api/support-billing';

export const dynamic = 'force-dynamic';

export const POST = route(postSupportBilling);
