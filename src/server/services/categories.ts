import type { PortalScope } from '@/lib/db/with-portal';

export interface CategoryDto {
  id: string;
  kind: 'INCOME' | 'EXPENSE';
  name: string;
  accentColor: string;
  sortOrder: number;
  isArchived: boolean;
  isSystem: boolean;
  usageCount: number;
}

/** All categories for the portal, grouped-ready (sorted by kind then sortOrder). */
export async function listCategories(
  scope: PortalScope,
  opts: { includeArchived?: boolean } = {},
): Promise<CategoryDto[]> {
  const rows = await scope.category.findMany({
    where: opts.includeArchived ? {} : { isArchived: false },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { entries: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    accentColor: c.accentColor,
    sortOrder: c.sortOrder,
    isArchived: c.isArchived,
    isSystem: c.isSystem,
    usageCount: c._count.entries,
  }));
}
