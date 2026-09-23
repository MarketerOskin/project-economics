import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PortalInstallation } from '@prisma/client';
import { classifyDealStage, fetchAllDeals, listDealCategories } from '@/lib/bitrix/deals';
import { encryptToken } from '@/lib/bitrix/crypto';

const portal = {
  id: 'p1',
  domain: 'x.bitrix24.ru',
  restEndpoint: 'https://x.bitrix24.ru/rest/',
  authTokenEnc: encryptToken('ACCESS'),
} as unknown as PortalInstallation;

describe('classifyDealStage', () => {
  it('classifies the default pipeline (bare WON/LOSE) and a named one (C{id}:WON/LOSE)', () => {
    expect(classifyDealStage('WON')).toBe('WON');
    expect(classifyDealStage('LOSE')).toBe('LOST');
    expect(classifyDealStage('C5:WON')).toBe('WON');
    expect(classifyDealStage('C5:LOSE')).toBe('LOST');
    expect(classifyDealStage('C5:PREPARATION')).toBe('IN_PROGRESS');
    expect(classifyDealStage('NEW')).toBe('IN_PROGRESS');
  });
});

describe('listDealCategories', () => {
  afterEach(() => vi.restoreAllMocks());

  it('normalises crm.category.list into {id, name}', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { categories: [{ id: '0', name: 'Первичные продажи' }, { id: 5, name: 'Абонентское обслуживание' }] } }),
        { status: 200 },
      ),
    );
    const categories = await listDealCategories(portal);
    expect(categories).toEqual([
      { id: 0, name: 'Первичные продажи' },
      { id: 5, name: 'Абонентское обслуживание' },
    ]);
  });
});

describe('fetchAllDeals', () => {
  afterEach(() => vi.restoreAllMocks());

  it('follows short-page pagination and stops on a page under 50', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const fullPage = Array.from({ length: 50 }, (_, i) => ({ id: i, categoryId: 0, stageId: 'WON', opportunity: '100' }));
    const lastPage = [{ id: 999, categoryId: 0, stageId: 'NEW', opportunity: '50' }];
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { items: fullPage } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { items: lastPage } }), { status: 200 }));

    const { rows, truncated } = await fetchAllDeals(portal);
    expect(rows).toHaveLength(51);
    expect(truncated).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('defaults a missing categoryId to 0 and a missing opportunity to "0"', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { items: [{ id: 1, stageId: 'NEW' }] } }), { status: 200 }),
    );
    const { rows } = await fetchAllDeals(portal);
    expect(rows).toEqual([{ categoryId: 0, stageId: 'NEW', opportunity: '0' }]);
  });
});
