import { route } from '@/server/handler';
import { setProjectMembers } from '@/server/api/projects';

export const dynamic = 'force-dynamic';

export const PUT = route<{ id: string }>(setProjectMembers);
