import { route } from '@/server/handler';
import { postRejectTimeDraft } from '@/server/api/time-drafts';

export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(postRejectTimeDraft);
