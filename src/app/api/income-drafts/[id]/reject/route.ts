import { route } from '@/server/handler';
import { postRejectIncomeDraft } from '@/server/api/crm-income-drafts';

export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(postRejectIncomeDraft);
