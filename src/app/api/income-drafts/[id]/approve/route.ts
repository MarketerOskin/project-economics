import { route } from '@/server/handler';
import { postApproveIncomeDraft } from '@/server/api/crm-income-drafts';

export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(postApproveIncomeDraft);
