import { route } from '@/server/handler';
import { getSupportBilling } from '@/server/api/support-billing';

export const dynamic = 'force-dynamic';

export const GET = route(getSupportBilling);
