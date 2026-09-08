import { route } from '@/server/handler';
import { getProject, updateProject } from '@/server/api/projects';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(getProject);
export const PATCH = route<{ id: string }>(updateProject);
