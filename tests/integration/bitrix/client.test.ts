import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { callBitrix } from '@/lib/bitrix/client';

process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.B24_CLIENT_ID = 'test-client';
process.env.B24_CLIENT_SECRET = 'test-secret';

async function makePortal() {
  return testDb.portalInstallation.create({
    data: {
      memberId: `m-${Math.random().toString(36).slice(2)}`,
      domain: 'acme.bitrix24.ru',
      authTokenEnc: encryptToken('OLD_ACCESS'),
      refreshTokenEnc: encryptToken('THE_REFRESH'),
      restEndpoint: 'https://acme.bitrix24.ru/rest/',
    },
  });
}

describe('callBitrix', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('calls the method and returns result', async () => {
    const portal = await makePortal();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [{ ID: '1' }] }), { status: 200 }),
    );
    const r = await callBitrix<{ ID: string }[]>(portal, 'user.get');
    expect(r).toEqual([{ ID: '1' }]);
  });

  it('refreshes on expired_token, re-stores encrypted tokens, retries once', async () => {
    const portal = await makePortal();
    const fetchMock = vi
      .spyOn(global, 'fetch')
      // 1st: expired
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'expired_token' }), { status: 401 }))
      // 2nd: oauth refresh
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'NEW_ACCESS', refresh_token: 'NEW_REFRESH', expires_in: 3600 }),
          { status: 200 },
        ),
      )
      // 3rd: retried call
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { ok: true } }), { status: 200 }));

    const r = await callBitrix<{ ok: boolean }>(portal, 'user.current');
    expect(r).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const reloaded = await testDb.portalInstallation.findUnique({ where: { id: portal.id } });
    expect(reloaded?.authTokenEnc).not.toBe(portal.authTokenEnc);
    expect(reloaded?.authTokenEnc).not.toContain('NEW_ACCESS'); // stored encrypted
  });

  it('never writes a token substring to the console', async () => {
    const portal = await makePortal();
    const logs: string[] = [];
    for (const m of ['log', 'error', 'warn', 'info'] as const) {
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => logs.push(a.join(' ')));
    }
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'QUERY_LIMIT_EXCEEDED', error_description: 'auth=OLD_ACCESS leaked?' }), {
        status: 400,
      }),
    );
    await expect(callBitrix(portal, 'user.get')).rejects.toThrow();
    expect(logs.join('\n')).not.toContain('OLD_ACCESS');
    expect(logs.join('\n')).not.toContain('THE_REFRESH');
    vi.restoreAllMocks();
  });
});
