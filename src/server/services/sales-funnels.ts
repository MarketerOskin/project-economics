import type { PortalScope } from '@/lib/db/with-portal';

export interface FunnelRow {
  categoryId: number;
  categoryName: string;
  wonCount: number;
  wonAmount: string;
  lostCount: number;
  lostAmount: string;
  inProgressCount: number;
  inProgressAmount: string;
}

/** Last nightly snapshot (ADR-029), pivoted from one row per semantic into one row per funnel. */
export async function listSalesFunnels(scope: PortalScope): Promise<{ funnels: FunnelRow[]; syncedAt: string | null }> {
  const rows = await scope.salesFunnelSnapshot.findMany({ orderBy: [{ categoryId: 'asc' }] });

  const byCategory = new Map<number, FunnelRow>();
  let syncedAt: string | null = null;

  for (const row of rows) {
    if (!syncedAt || row.syncedAt.toISOString() > syncedAt) syncedAt = row.syncedAt.toISOString();
    const existing = byCategory.get(row.categoryId) ?? {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      wonCount: 0,
      wonAmount: '0',
      lostCount: 0,
      lostAmount: '0',
      inProgressCount: 0,
      inProgressAmount: '0',
    };
    if (row.semantic === 'WON') {
      existing.wonCount = row.dealCount;
      existing.wonAmount = row.totalAmount.toString();
    } else if (row.semantic === 'LOST') {
      existing.lostCount = row.dealCount;
      existing.lostAmount = row.totalAmount.toString();
    } else {
      existing.inProgressCount = row.dealCount;
      existing.inProgressAmount = row.totalAmount.toString();
    }
    byCategory.set(row.categoryId, existing);
  }

  return { funnels: [...byCategory.values()], syncedAt };
}
