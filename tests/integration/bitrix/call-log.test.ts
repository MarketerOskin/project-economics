import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { callBitrix, callBitrixWithToken } from '@/lib/bitrix/client';
import { API_LOG_RETENTION_DAYS, purgeOldApiLogs } from '@/lib/bitrix/call-log';

process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

async function makePortal() {
  return testDb.portalInstallation.create({
    data: {
      memberId: `m-${Math.random().toString(36).slice(2)}`,
      domain: 'acme.bitrix24.ru',
      authTokenEnc: encryptToken('SECRET_ACCESS_TOKEN'),
      restEndpoint: 'https://acme.bitrix24.ru/rest/',
    },
  });
}

describe('REST call log (Marketplace: keep server-side request/response logs >= 3 days)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('records the method, params and response of a successful call — never the token', async () => {
    const portal = await makePortal();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [{ ID: '1', NAME: 'Пётр' }] }), { status: 200 }),
    );
    await callBitrix(portal, 'user.get', { FILTER: { ACTIVE: true } });

    const [row] = await testDb.apiCallLog.findMany({ where: { portalId: portal.id } });
    expect(row).toBeDefined();
    expect(row!.method).toBe('user.get');
    expect(row!.ok).toBe(true);
    expect(row!.request).toContain('ACTIVE');
    expect(row!.response).toContain('Пётр');
    expect(row!.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(row)).not.toContain('SECRET_ACCESS_TOKEN');
  });

  it('records a Bitrix error response with its error code', async () => {
    const portal = await makePortal();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'ACCESS_DENIED', error_description: 'nope' }), { status: 200 }),
    );
    await expect(callBitrix(portal, 'crm.item.list')).rejects.toThrow();

    const [row] = await testDb.apiCallLog.findMany({ where: { portalId: portal.id } });
    expect(row!.ok).toBe(false);
    expect(row!.errorCode).toBe('ACCESS_DENIED');
  });

  it('records a network failure', async () => {
    const portal = await makePortal();
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(callBitrix(portal, 'user.get')).rejects.toThrow();

    const [row] = await testDb.apiCallLog.findMany({ where: { portalId: portal.id } });
    expect(row!.ok).toBe(false);
    expect(row!.errorCode).toBe('NETWORK');
  });

  it('logs per-user-token calls too, without leaking that token', async () => {
    const portal = await makePortal();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { ID: '7', ADMIN: true } }), { status: 200 }),
    );
    await callBitrixWithToken(portal, 'USER_SESSION_TOKEN', 'user.current');

    const [row] = await testDb.apiCallLog.findMany({ where: { portalId: portal.id } });
    expect(row!.method).toBe('user.current');
    expect(JSON.stringify(row)).not.toContain('USER_SESSION_TOKEN');
  });

  it('a failing log write never breaks the Bitrix call', async () => {
    const portal = await makePortal();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: true }), { status: 200 }),
    );
    // Portal id that violates the FK -> the insert throws inside the logger.
    const ghost = { ...portal, id: 'does-not-exist' };
    await expect(callBitrix(ghost, 'app.info')).resolves.toBe(true);
  });

  it(`purges entries older than ${API_LOG_RETENTION_DAYS} days and keeps newer ones`, async () => {
    const portal = await makePortal();
    const day = 24 * 60 * 60 * 1000;
    const mk = (ageDays: number) =>
      testDb.apiCallLog.create({
        data: { portalId: portal.id, method: `m${ageDays}`, ok: true, durationMs: 1, createdAt: new Date(Date.now() - ageDays * day) },
      });
    await mk(1);
    await mk(4);
    await mk(API_LOG_RETENTION_DAYS + 1);

    const removed = await purgeOldApiLogs(true);
    expect(removed).toBe(1);
    const left = (await testDb.apiCallLog.findMany({ where: { portalId: portal.id } })).map((r) => r.method).sort();
    expect(left).toEqual(['m1', 'm4']);
  });
});
