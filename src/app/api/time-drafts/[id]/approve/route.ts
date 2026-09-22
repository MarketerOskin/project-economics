import { route } from '@/server/handler';
import { postApproveTimeDraft } from '@/server/api/time-drafts';

export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(postApproveTimeDraft);
