import type { PortalInstallation } from '@prisma/client';
import { db } from '@/lib/db/client';
import { effectivePlan } from '@/lib/billing/plan';
import { m, sum } from '@/domain/finance';
import { classifyDealStage, fetchAllDeals, listDealCategories } from '@/lib/bitrix/deals';

export interface SyncFunnelsResult {
  funnels: number;
  deals: number;
  truncated: boolean;
}

interface Bucket {
  categoryId: number;
  semantic: 'WON' | 'LOST' | 'IN_PROGRESS';
  count: number;
  amounts: ReturnType<typeof m>[];
}

/**
 * Read-only nightly snapshot — never writes to FinancialEntry, only informs the "Продажи по
 * воронкам" report (ADR-029). One row per (funnel, won/lost/in-progress); stale combinations
 * from a previous sync (a funnel that now has zero deals in that state) are deleted so the
 * report never shows a number that no longer has any deals behind it.
 */
export async function syncPortalSalesFunnels(portal: PortalInstallation): Promise<SyncFunnelsResult> {
  const categories = await listDealCategories(portal);
  const { rows, truncated } = await fetchAllDeals(portal);

  const buckets = new Map<string, Bucket>();
  for (const row of rows) {
    const semantic = classifyDealStage(row.stageId);
    const key = `${row.categoryId}:${semantic}`;
    const bucket = buckets.get(key) ?? { categoryId: row.categoryId, semantic, count: 0, amounts: [] };
    bucket.count += 1;
    bucket.amounts.push(m(row.opportunity || '0'));
    buckets.set(key, bucket);
  }

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const nameFor = (categoryId: number) => categoryNameById.get(categoryId) ?? `Воронка ${categoryId}`;

  await db.$transaction(async (tx) => {
    const currentKeys = new Set(buckets.keys());

    for (const bucket of buckets.values()) {
      await tx.salesFunnelSnapshot.upsert({
        where: {
          portalId_categoryId_semantic: { portalId: portal.id, categoryId: bucket.categoryId, semantic: bucket.semantic },
        },
        create: {
          portalId: portal.id,
          categoryId: bucket.categoryId,
          categoryName: nameFor(bucket.categoryId),
          semantic: bucket.semantic,
          dealCount: bucket.count,
          totalAmount: sum(bucket.amounts).toDecimalPlaces(2),
        },
        update: {
          categoryName: nameFor(bucket.categoryId),
          dealCount: bucket.count,
          totalAmount: sum(bucket.amounts).toDecimalPlaces(2),
          syncedAt: new Date(),
        },
      });
    }

    const existing = await tx.salesFunnelSnapshot.findMany({ where: { portalId: portal.id } });
    const staleIds = existing.filter((row) => !currentKeys.has(`${row.categoryId}:${row.semantic}`)).map((row) => row.id);
    if (staleIds.length > 0) {
      await tx.salesFunnelSnapshot.deleteMany({ where: { id: { in: staleIds } } });
    }
  });

  return { funnels: categories.length, deals: rows.length, truncated };
}

export async function syncAllPortalsSalesFunnels(): Promise<Record<string, SyncFunnelsResult | { error: string }>> {
  const candidates = await db.portalInstallation.findMany({
    where: { isActive: true, isDemo: false, authTokenEnc: { not: null } },
  });
  const portals = candidates.filter((p) => effectivePlan(p) === 'PRO');

  const byPortal: Record<string, SyncFunnelsResult | { error: string }> = {};
  for (const portal of portals) {
    try {
      byPortal[portal.id] = await syncPortalSalesFunnels(portal);
    } catch (err) {
      byPortal[portal.id] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return byPortal;
}
