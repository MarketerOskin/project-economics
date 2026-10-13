import { route } from '@/server/handler';
import { listStreams, postStream } from '@/server/api/streams';

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(listStreams);
export const POST = route<{ id: string }>(postStream);
