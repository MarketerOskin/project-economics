import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { POST as installRoute } from '@/app/api/bitrix/install/route';

process.env.SESSION_SECRET = 'install-event-test-secret-at-least-32-bytes';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new NextRequest('http://localhost/api/bitrix/install', { method: 'POST', body: fd });
}

function mockBitrixFetch() {
  return vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('user.admin')) return new Response(JSON.stringify({ result: true }), { status: 200 });
    if (u.includes('user.current')) return new Response(JSON.stringify({ result: { ID: '1', NAME: 'A', LAST_NAME: 'B' } }), { status: 200 });
    return new Response(JSON.stringify({ result: true }), { status: 200 });
  });
}

/**
 * Some Bitrix24 "rest-only" app configurations deliver ONAPPUNINSTALL (and other lifecycle
 * events) to the SAME URL as the install handler — confirmed against real production logs for
 * it-wizards.bitrix24.ru (ADR-030). Before the fix, this fell through to
 * upsertPortalFromInstall, which threw "missing member_id / DOMAIN" and 400'd, silently
 * skipping the data-purge-on-uninstall the Marketplace review requires.
 */
describe('/api/bitrix/install recognises a misrouted lifecycle event (ADR-030)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('ONAPPUNINSTALL with CLEAN=1 purges the portal instead of 400ing as a bad install', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { applicationToken: 'APP_TOKEN' },
    });
    const memberId = (await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } })).memberId;

    const res = await installRoute(
      form({ event: 'ONAPPUNINSTALL', 'data[CLEAN]': '1', 'auth[member_id]': memberId, 'auth[application_token]': 'APP_TOKEN' }),
    );

    expect(res.status).toBe(200);
    expect(await testDb.portalInstallation.count({ where: { id: s.portalId } })).toBe(0);
  });

  it('a real install payload (no `event` field) is unaffected — still installs normally', async () => {
    mockBitrixFetch();
    const res = await installRoute(
      form({
        DOMAIN: 'newportal.bitrix24.ru',
        AUTH_ID: 'auth-id-value',
        REFRESH_ID: 'refresh-id-value',
        member_id: 'brand-new-member-id',
        AUTH_EXPIRES: '3600',
      }),
    );
    expect(res.status).toBe(307);
    expect(await testDb.portalInstallation.count({ where: { memberId: 'brand-new-member-id' } })).toBe(1);
  });
});
