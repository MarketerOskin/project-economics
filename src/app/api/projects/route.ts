import { route } from '@/server/handler';
import { createProject, listProjects } from '@/server/api/projects';

export const dynamic = 'force-dynamic';

export const GET = route(listProjects);
export const POST = route(createProject);
