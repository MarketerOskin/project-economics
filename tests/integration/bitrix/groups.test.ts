import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PortalInstallation } from '@prisma/client';
import { getBitrixProjectGroup, listBitrixProjectGroups } from '@/lib/bitrix/groups';
import { encryptToken } from '@/lib/bitrix/crypto';

const portal = {
  id: 'p1',
  domain: 'x.bitrix24.ru',
  restEndpoint: 'https://x.bitrix24.ru/rest/',
  authTokenEnc: encryptToken('ACCESS'),
} as unknown as PortalInstallation;

describe('Bitrix24 native "Проекты" (sonet_group) helpers (ADR-031)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('listBitrixProjectGroups filters to PROJECT=Y, ACTIVE=Y and normalises the URL', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: [{ ID: '11', NAME: 'Запуск склада' }] }), { status: 200 }),
      );

    const groups = await listBitrixProjectGroups(portal);
    expect(groups).toEqual([{ id: '11', title: 'Запуск склада', url: 'https://x.bitrix24.ru/workgroups/group/11/' }]);

    const body = (fetchSpy.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams;
    expect(body.get('FILTER[PROJECT]')).toBe('Y');
    expect(body.get('FILTER[ACTIVE]')).toBe('Y');
  });

  it('listBitrixProjectGroups passes a name search filter when q is given', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ result: [] }), { status: 200 }));
    await listBitrixProjectGroups(portal, { q: 'склад' });
    const body = (fetchSpy.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams;
    expect(body.get('FILTER[%NAME]')).toBe('склад');
  });

  it('getBitrixProjectGroup returns null when Bitrix finds nothing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ result: [] }), { status: 200 }));
    expect(await getBitrixProjectGroup(portal, '999')).toBeNull();
  });

  it('getBitrixProjectGroup normalises the single matching group', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [{ ID: 11, NAME: 'Запуск склада' }] }), { status: 200 }),
    );
    expect(await getBitrixProjectGroup(portal, '11')).toEqual({
      id: '11',
      title: 'Запуск склада',
      url: 'https://x.bitrix24.ru/workgroups/group/11/',
    });
  });
});
