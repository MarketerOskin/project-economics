import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PortalInstallation } from '@prisma/client';
import { crmTaskBinding, listElapsedTime, listTaskIdsBoundToCrm } from '@/lib/bitrix/tasks';
import { encryptToken } from '@/lib/bitrix/crypto';

const portal = {
  id: 'p1',
  domain: 'x.bitrix24.ru',
  restEndpoint: 'https://x.bitrix24.ru/rest/',
  authTokenEnc: encryptToken('ACCESS'),
} as unknown as PortalInstallation;

describe('crmTaskBinding (ADR-027)', () => {
  it('binds Deal, Company and a Smart Process by their Bitrix24 CCrmOwnerType-style prefix', () => {
    expect(crmTaskBinding(2, '101')).toBe('D_101');
    expect(crmTaskBinding(4, '201')).toBe('CO_201');
    expect(crmTaskBinding(1068, '7')).toBe('T1068_7');
  });
});

describe('Bitrix24 task time helpers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('listTaskIdsBoundToCrm filters tasks.task.list by the UF_CRM_TASK binding', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { tasks: [{ id: '5' }, { id: 9 }] } }), { status: 200 }));

    const ids = await listTaskIdsBoundToCrm(portal, 1068, '7');
    expect(ids).toEqual([5, 9]);

    const body = (fetchSpy.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams;
    expect(body.get('filter[UF_CRM_TASK][0]')).toBe('T1068_7');
  });

  it('listElapsedTime converts MINUTES to hours and reads the log date', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: [
            { ID: '1', USER_ID: '42', CREATED_DATE: '2026-09-10T10:00:00+03:00', MINUTES: '90' },
            { ID: '2', USER_ID: '42', CREATED_DATE: '2026-09-11T10:00:00+03:00', MINUTES: '30' },
          ],
        }),
        { status: 200 },
      ),
    );

    const items = await listElapsedTime(portal, 5);
    expect(items).toEqual([
      { bitrixUserId: '42', workDate: '2026-09-10', hours: 1.5 },
      { bitrixUserId: '42', workDate: '2026-09-11', hours: 0.5 },
    ]);
  });

  it('listElapsedTime falls back to SECONDS when MINUTES is absent', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: [{ ID: '1', USER_ID: '7', CREATED_DATE: '2026-09-10', SECONDS: '3600' }] }),
        { status: 200 },
      ),
    );
    const items = await listElapsedTime(portal, 5);
    expect(items[0]?.hours).toBe(1);
  });
});
