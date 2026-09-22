import { route } from '@/server/handler';
import { getImportSources, postImportSource } from '@/server/api/crm-sources';

export const dynamic = 'force-dynamic';

export const GET = route(getImportSources);
export const POST = route(postImportSource);
