import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { withPortal } from '@/lib/db/with-portal';
import { listSalesFunnels } from '@/server/services/sales-funnels';

describe('listSalesFunnels — pivots the per-semantic snapshot rows into one row per funnel', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('pivots WON/LOST/IN_PROGRESS rows for the same funnel into one row', async () => {
    const s = await seedPortal();
    await testDb.salesFunnelSnapshot.createMany({
      data: [
        { portalId: s.portalId, categoryId: 0, categoryName: 'Первичные продажи', semantic: 'WON', dealCount: 2, totalAmount: '150000' },
        { portalId: s.portalId, categoryId: 0, categoryName: 'Первичные продажи', semantic: 'IN_PROGRESS', dealCount: 1, totalAmount: '30000' },
        { portalId: s.portalId, categoryId: 5, categoryName: 'Абонентское обслуживание', semantic: 'LOST', dealCount: 1, totalAmount: '20000' },
      ],
    });

    const { funnels } = await listSalesFunnels(withPortal(s.portalId));
    expect(funnels).toHaveLength(2);
    const primary = funnels.find((f) => f.categoryId === 0)!;
    expect(primary.wonCount).toBe(2);
    expect(primary.wonAmount).toBe('150000');
    expect(primary.inProgressCount).toBe(1);
    expect(primary.lostCount).toBe(0);
    const subscriptions = funnels.find((f) => f.categoryId === 5)!;
    expect(subscriptions.lostCount).toBe(1);
    expect(subscriptions.categoryName).toBe('Абонентское обслуживание');
  });

  it('is portal-scoped — another portal\'s snapshot never leaks in', async () => {
    const s1 = await seedPortal();
    const s2 = await seedPortal();
    await testDb.salesFunnelSnapshot.create({
      data: { portalId: s2.portalId, categoryId: 0, categoryName: 'Чужая воронка', semantic: 'WON', dealCount: 1, totalAmount: '1' },
    });

    const { funnels } = await listSalesFunnels(withPortal(s1.portalId));
    expect(funnels).toEqual([]);
  });
});
