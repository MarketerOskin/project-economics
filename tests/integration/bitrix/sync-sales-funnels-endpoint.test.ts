import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { POST as syncFunnelsRoute } from '@/app/api/internal/sync-sales-funnels/route';

process.env.SESSION_SECRET = 'sync-funnels-test-secret-at-least-32-bytes';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const req = (headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/internal/sync-sales-funnels', { method: 'POST', headers: new Headers(headers) });

describe('POST /api/internal/sync-sales-funnels — cron entrypoint (ADR-029)', () => {
  const originalSecret = process.env.INTERNAL_SYNC_SECRET;

  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterEach(() => {
    process.env.INTERNAL_SYNC_SECRET = originalSecret;
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('503s when the secret is not configured', async () => {
    delete process.env.INTERNAL_SYNC_SECRET;
    expect((await syncFunnelsRoute(req({ 'x-sync-secret': 'anything' }))).status).toBe(503);
  });

  it('401s with a wrong or missing secret', async () => {
    process.env.INTERNAL_SYNC_SECRET = 'correct-secret';
    expect((await syncFunnelsRoute(req())).status).toBe(401);
    expect((await syncFunnelsRoute(req({ 'x-sync-secret': 'wrong' }))).status).toBe(401);
  });

  it('runs the sync across eligible portals with the correct secret', async () => {
    process.env.INTERNAL_SYNC_SECRET = 'correct-secret';
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
    });
    const emptyBatch: Record<string, { items: unknown[] }> = {};
    for (let i = 0; i < 50; i++) emptyBatch[`p${i}`] = { items: [] };
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { categories: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { result: emptyBatch } }), { status: 200 }));

    const res = await syncFunnelsRoute(req({ 'x-sync-secret': 'correct-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.portals[s.portalId]).toEqual({ funnels: 0, deals: 0, truncated: false });
  });
});
