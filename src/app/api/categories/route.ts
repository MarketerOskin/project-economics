import { route } from '@/server/handler';
import { listCategories } from '@/server/services/categories';
import { createCategory } from '@/server/api/categories';

export const dynamic = 'force-dynamic';

export const GET = route(async ({ req, scope }) => {
  const includeArchived = new URL(req.url).searchParams.get('includeArchived') === 'true';
  return { categories: await listCategories(scope, { includeArchived }) };
});

export const POST = route(createCategory);
