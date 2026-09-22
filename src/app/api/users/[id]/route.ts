import { route } from '@/server/handler';
import { patchUser } from '@/server/api/users';

export const dynamic = 'force-dynamic';

export const PATCH = route<{ id: string }>(patchUser);
