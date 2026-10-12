import { route } from '@/server/handler';
import { linkProjectToBitrix } from '@/server/api/project-bitrix-link';

export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(linkProjectToBitrix);
