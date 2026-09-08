import { route } from '@/server/handler';
import { listEntries, postEntry } from '@/server/api/finance';

export const dynamic = 'force-dynamic';

export const GET = route(listEntries);
export const POST = route(postEntry);
