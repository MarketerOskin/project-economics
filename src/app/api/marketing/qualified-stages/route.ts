import { route } from '@/server/handler';
import { putQualifiedStages } from '@/server/api/marketing';

export const dynamic = 'force-dynamic';

export const PUT = route(putQualifiedStages);
