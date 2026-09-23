import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { syncAllPortalsSalesFunnels, syncPortalSalesFunnels } from '@/server/services/sales-funnel-sync';

process.env.SESSION_SECRET = 'sales-funnel-test-secret-at-least-32-bytes';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

async function connectPortal(portalId: string) {
  await testDb.portalInstallation.update({
    where: { id: portalId },
    data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
  });
}

function mockSync(categories: Array<{ id: number; name: string }>, deals: Array<{ categoryId: number; stageId: string; opportunity: string }>) {
  const fetchSpy = vi.spyOn(global, 'fetch');
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ result: { categories } }), { status: 200 }));
  // fetchAllDeals batches 50 crm.item.list pages per HTTP round trip (ADR-029) — page 0 gets
  // every deal here (well under 50), the rest of the batch's 50 slots are empty.
  const batchResult: Record<string, { items: unknown[] }> = { p0: { items: deals.map((d, i) => ({ id: i, ...d })) } };
  for (let i = 1; i < 50; i++) batchResult[`p${i}`] = { items: [] };
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ result: { result: batchResult } }), { status: 200 }));
  return fetchSpy;
}

describe('sales funnel snapshot sync (ADR-029)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('groups deals by funnel and won/lost/in-progress', async () => {
    const s = await seedPortal();
    await connectPortal(s.portalId);
    mockSync(
      [{ id: 0, name: 'Первичные продажи' }, { id: 5, name: 'Абонентское обслуживание' }],
      [
        { categoryId: 0, stageId: 'WON', opportunity: '100000' },
        { categoryId: 0, stageId: 'WON', opportunity: '50000' },
        { categoryId: 0, stageId: 'NEW', opportunity: '30000' },
        { categoryId: 5, stageId: 'C5:LOSE', opportunity: '20000' },
      ],
    );

    const result = await syncPortalSalesFunnels(await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } }));
    expect(result.funnels).toBe(2);
    expect(result.deals).toBe(4);

    const rows = await testDb.salesFunnelSnapshot.findMany({ where: { portalId: s.portalId }, orderBy: [{ categoryId: 'asc' }, { semantic: 'asc' }] });
    expect(rows).toHaveLength(3);
    const won0 = rows.find((r) => r.categoryId === 0 && r.semantic === 'WON')!;
    expect(won0.dealCount).toBe(2);
    expect(won0.totalAmount.toString()).toBe('150000');
    const inProgress0 = rows.find((r) => r.categoryId === 0 && r.semantic === 'IN_PROGRESS')!;
    expect(inProgress0.dealCount).toBe(1);
    const lost5 = rows.find((r) => r.categoryId === 5 && r.semantic === 'LOST')!;
    expect(lost5.categoryName).toBe('Абонентское обслуживание');
  });

  it('deletes a stale bucket that no longer has any deals behind it', async () => {
    const s = await seedPortal();
    await connectPortal(s.portalId);
    await testDb.salesFunnelSnapshot.create({
      data: { portalId: s.portalId, categoryId: 0, categoryName: 'Первичные продажи', semantic: 'LOST', dealCount: 3, totalAmount: '9000' },
    });

    mockSync([{ id: 0, name: 'Первичные продажи' }], [{ categoryId: 0, stageId: 'WON', opportunity: '1000' }]);

    await syncPortalSalesFunnels(await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } }));

    const rows = await testDb.salesFunnelSnapshot.findMany({ where: { portalId: s.portalId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.semantic).toBe('WON');
  });

  it('syncAllPortalsSalesFunnels skips FREE-plan and demo portals', async () => {
    const free = await seedPortal();
    const demo = await seedPortal({ isDemo: true });
    await testDb.portalInstallation.update({ where: { id: demo.portalId }, data: { authTokenEnc: encryptToken('ACCESS') } });

    const fetchSpy = vi.spyOn(global, 'fetch');
    const byPortal = await syncAllPortalsSalesFunnels();
    expect(byPortal[free.portalId]).toBeUndefined();
    expect(byPortal[demo.portalId]).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a failure for one portal is captured, not thrown, so other portals still sync', async () => {
    const s = await seedPortal();
    await connectPortal(s.portalId);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', error_description: 'boom' }), { status: 200 }),
    );

    const byPortal = await syncAllPortalsSalesFunnels();
    expect(byPortal[s.portalId]).toHaveProperty('error');
  });
});
