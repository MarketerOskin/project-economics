import { route } from '@/server/handler';
import { deleteStream, patchStream } from '@/server/api/streams';

export const dynamic = 'force-dynamic';

export const PATCH = route<{ id: string; streamId: string }>(patchStream);
export const DELETE = route<{ id: string; streamId: string }>(deleteStream);
