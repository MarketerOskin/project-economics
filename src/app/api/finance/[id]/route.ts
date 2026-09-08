import { route } from '@/server/handler';
import { deleteEntry, patchEntry } from '@/server/api/finance';

export const dynamic = 'force-dynamic';

export const PATCH = route<{ id: string }>(patchEntry);
export const DELETE = route<{ id: string }>(deleteEntry);
