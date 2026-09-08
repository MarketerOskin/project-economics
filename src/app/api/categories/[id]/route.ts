import { route } from '@/server/handler';
import { deleteCategory, updateCategory } from '@/server/api/categories';

export const dynamic = 'force-dynamic';

export const PATCH = route<{ id: string }>(updateCategory);
export const DELETE = route<{ id: string }>(deleteCategory);
