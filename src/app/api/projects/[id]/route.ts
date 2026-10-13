import { route } from '@/server/handler';
import { deleteProject, getProject, updateProject } from '@/server/api/projects';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(getProject);
export const PATCH = route<{ id: string }>(updateProject);
export const DELETE = route<{ id: string }>(deleteProject);
