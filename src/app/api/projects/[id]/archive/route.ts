import { route } from '@/server/handler';
import { archiveProject } from '@/server/api/projects';

export const dynamic = 'force-dynamic';

export const POST = route<{ id: string }>(archiveProject);
