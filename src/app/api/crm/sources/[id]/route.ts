import { route } from '@/server/handler';
import { deleteImportSource } from '@/server/api/crm-sources';

export const dynamic = 'force-dynamic';

export const DELETE = route<{ id: string }>(deleteImportSource);
