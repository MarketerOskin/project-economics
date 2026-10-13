import { route } from '@/server/handler';
import { postSpend } from '@/server/api/marketing';

export const dynamic = 'force-dynamic';

export const POST = route(postSpend);
