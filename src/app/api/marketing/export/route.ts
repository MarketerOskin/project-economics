import { route } from '@/server/handler';
import { exportMarketing } from '@/server/api/marketing';

export const dynamic = 'force-dynamic';

export const GET = route(exportMarketing);
