import { route } from '@/server/handler';
import { removeSpend } from '@/server/api/marketing';

export const dynamic = 'force-dynamic';

export const DELETE = route<{ id: string }>(removeSpend);
