import { route } from '@/server/handler';
import { exportAnalytics } from '@/server/api/analytics';

export const dynamic = 'force-dynamic';

export const GET = route(exportAnalytics);
