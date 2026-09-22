import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { POST as syncHoursRoute } from '@/app/api/internal/sync-hours/route';

process.env.SESSION_SECRET = 'sync-hours-test-secret-at-least-32-bytes-xxx';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const req = (headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/internal/sync-hours', { method: 'POST', headers: new Headers(headers) });

describe('POST /api/internal/sync-hours — cron entrypoint (ADR-027)', () => {
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

  it('503s when the secret is not configured at all', async () => {
    delete process.env.INTERNAL_SYNC_SECRET;
    const res = await syncHoursRoute(req({ 'x-sync-secret': 'anything' }));
    expect(res.status).toBe(503);
  });

  it('401s with a wrong or missing secret', async () => {
    process.env.INTERNAL_SYNC_SECRET = 'correct-secret';
    expect((await syncHoursRoute(req())).status).toBe(401);
    expect((await syncHoursRoute(req({ 'x-sync-secret': 'wrong' }))).status).toBe(401);
  });

  it('runs the sync across eligible portals with the correct secret', async () => {
    process.env.INTERNAL_SYNC_SECRET = 'correct-secret';
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
    });
    // No CRM-imported projects on this portal — sync runs, finds nothing, no fetch needed.
    const fetchSpy = vi.spyOn(global, 'fetch');

    const res = await syncHoursRoute(req({ 'x-sync-secret': 'correct-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.portals[s.portalId]).toEqual({ projectsSynced: 0, draftsUpserted: 0, errors: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
