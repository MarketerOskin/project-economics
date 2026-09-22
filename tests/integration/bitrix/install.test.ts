import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb } from '../../helpers/db';
import { POST as installRoute } from '@/app/api/bitrix/install/route';
import { POST as handlerRoute } from '@/app/api/bitrix/handler/route';
import { POST as eventsRoute } from '@/app/api/bitrix/events/route';

process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.SESSION_SECRET = 'bitrix-install-test-secret-32-bytes-xxxxx';
process.env.APP_URL = 'https://economics.example.com';

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new NextRequest('http://localhost/api/bitrix/x', { method: 'POST', body: fd });
}

/** Real Bitrix24 install requests split fields: some on the query string, some in the body. */
function splitRequest(query: Record<string, string>, body: Record<string, string>) {
  const qs = new URLSearchParams(query).toString();
  const fd = new FormData();
  for (const [k, v] of Object.entries(body)) fd.append(k, v);
  return new NextRequest(`http://localhost/api/bitrix/x?${qs}`, { method: 'POST', body: fd });
}

/**
 * install now also calls user.current + user.admin (it opens the app immediately after
 * installing, not just storing tokens — see install/route.ts), on top of placement.bind.
 * Admin status comes from user.admin, not a `me.ADMIN` field on user.current's response —
 * that field doesn't exist in any user.* scope version (confirmed against production
 * traffic, ADR-025). Route by URL so all three calls get a shape they can parse.
 */
function mockBitrixFetch(user: Partial<{ ID: string; NAME: string; LAST_NAME: string }> = {}, isAdmin = true) {
  const me = { ID: '1', NAME: 'Admin', LAST_NAME: 'Adminov', ...user };
  return vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('user.admin')) return new Response(JSON.stringify({ result: isAdmin }), { status: 200 });
    if (u.includes('user.current')) return new Response(JSON.stringify({ result: me }), { status: 200 });
    return new Response(JSON.stringify({ result: true }), { status: 200 });
  });
}

describe('Bitrix install + handler (ТЗ §42, §44)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('install creates a portal with encrypted tokens, seeds default categories, and opens a session', async () => {
    mockBitrixFetch();

    const res = await installRoute(
      form({
        AUTH_ID: 'ACCESS_TOKEN_VALUE',
        REFRESH_ID: 'REFRESH_TOKEN_VALUE',
        member_id: 'acme',
        DOMAIN: 'acme.bitrix24.ru',
        application_token: 'APP_TOKEN',
      }),
    );
    expect(res.status).toBe(307);
    const setCookie = res.headers.getSetCookie().join(';');
    expect(setCookie).toContain('pe_session=');
    // CHIPS: without this, third-party-cookie-blocking browsers (e.g. Yandex Browser)
    // silently drop the cookie inside the Bitrix24 iframe — confirmed in production logs.
    expect(setCookie).toContain('Partitioned');

    const portal = await testDb.portalInstallation.findUnique({ where: { memberId: 'acme' } });
    expect(portal).not.toBeNull();
    expect(portal?.authTokenEnc).toBeTruthy();
    expect(portal?.authTokenEnc).not.toContain('ACCESS_TOKEN_VALUE');
    expect(portal?.applicationToken).toBe('APP_TOKEN');

    const cats = await testDb.financeCategory.count({ where: { portalId: portal!.id } });
    expect(cats).toBe(6);
  });

  it('install succeeds when DOMAIN/PROTOCOL/LANG/APP_SID arrive on the query string, not the body (real Bitrix24 request shape)', async () => {
    mockBitrixFetch();

    const res = await installRoute(
      splitRequest(
        { DOMAIN: 'query-domain.bitrix24.ru', PROTOCOL: '1', LANG: 'ru', APP_SID: 'sid123' },
        { AUTH_ID: 'A', REFRESH_ID: 'R', member_id: 'query-domain-member', application_token: 'APP_TOKEN' },
      ),
    );
    expect(res.status).toBe(307);

    const portal = await testDb.portalInstallation.findUnique({ where: { memberId: 'query-domain-member' } });
    expect(portal).not.toBeNull();
    expect(portal?.domain).toBe('query-domain.bitrix24.ru');
  });

  it('install subscribes to ONAPPUNINSTALL (event.bind) so uninstalls reach /api/bitrix/events', async () => {
    const urls: string[] = [];
    const bodies: string[] = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      urls.push(String(url));
      bodies.push(String((init as RequestInit)?.body ?? ''));
      const u = String(url);
      if (u.includes('user.admin')) return new Response(JSON.stringify({ result: true }), { status: 200 });
      if (u.includes('user.current')) {
        return new Response(JSON.stringify({ result: { ID: '1', NAME: 'A', LAST_NAME: 'B' } }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: true }), { status: 200 });
    });

    await installRoute(
      form({ AUTH_ID: 'A', REFRESH_ID: 'R', member_id: 'ev-bind', DOMAIN: 'ev-bind.bitrix24.ru', application_token: 'T' }),
    );

    const i = urls.findIndex((u) => u.includes('event.bind.json'));
    expect(i).toBeGreaterThanOrEqual(0);
    const params = new URLSearchParams(bodies[i]);
    expect(params.get('event')).toBe('ONAPPUNINSTALL');
    expect(params.get('handler')).toBe('https://economics.example.com/api/bitrix/events');
  });

  it('install still rejects a request with no DOMAIN anywhere (query or body)', async () => {
    const res = await installRoute(
      form({ AUTH_ID: 'A', member_id: 'no-domain-member', application_token: 'APP_TOKEN' }),
    );
    expect(res.status).toBe(400);
    expect(await testDb.portalInstallation.findUnique({ where: { memberId: 'no-domain-member' } })).toBeNull();
  });

  it('handler resolves the current user (admin) and issues a session cookie', async () => {
    mockBitrixFetch();
    await installRoute(
      form({ AUTH_ID: 'A', REFRESH_ID: 'R', member_id: 'acme', DOMAIN: 'acme.bitrix24.ru', application_token: 'APP_TOKEN' }),
    );

    mockBitrixFetch({ ID: '7', NAME: 'Пётр', LAST_NAME: 'Админов' }, true);

    const res = await handlerRoute(
      form({ member_id: 'acme', application_token: 'APP_TOKEN', AUTH_ID: 'A2', REFRESH_ID: 'R2' }),
    );
    expect(res.status).toBe(307);
    const setCookie = res.headers.getSetCookie().join(';');
    expect(setCookie).toContain('pe_session=');

    const user = await testDb.appUser.findFirst({ where: { bitrixUserId: '7' } });
    expect(user?.isBitrixAdmin).toBe(true);
    expect(user?.role).toBe('ADMIN');
  });

  it('an admin is recognised even though user.current never sends an ADMIN field at all (real Bitrix24 shape, ADR-025)', async () => {
    await installRoute(
      form({ AUTH_ID: 'A', REFRESH_ID: 'R', member_id: 'real-shape', DOMAIN: 'real-shape.bitrix24.ru', application_token: 'T' }),
    );
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('user.admin')) return new Response(JSON.stringify({ result: true }), { status: 200 });
      if (u.includes('user.current')) {
        // No ADMIN key anywhere — exactly what production traffic showed (ApiCallLog).
        return new Response(
          JSON.stringify({ result: { ID: '7981', NAME: 'Василий', LAST_NAME: 'Оськин', ACTIVE: true, IS_ONLINE: 'Y' } }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ result: true }), { status: 200 });
    });

    const res = await handlerRoute(
      form({ member_id: 'real-shape', application_token: 'T', AUTH_ID: 'A2', REFRESH_ID: 'R2' }),
    );
    expect(res.status).toBe(307);

    const user = await testDb.appUser.findFirst({ where: { bitrixUserId: '7981' } });
    expect(user?.isBitrixAdmin).toBe(true);
    expect(user?.role).toBe('ADMIN');
  });

  it('handler also accepts member_id/AUTH_ID on the query string (same split as install)', async () => {
    mockBitrixFetch();
    await installRoute(
      form({ AUTH_ID: 'A', member_id: 'qs-handler', DOMAIN: 'qs-handler.bitrix24.ru', application_token: 'APP_TOKEN' }),
    );
    mockBitrixFetch({ ID: '9', NAME: 'Ева', LAST_NAME: 'Сотрудникова' }, false);

    const res = await handlerRoute(
      splitRequest(
        { member_id: 'qs-handler', application_token: 'APP_TOKEN' },
        { AUTH_ID: 'A2' },
      ),
    );
    expect(res.status).toBe(307);
  });

  it('handler rejects a wrong application_token', async () => {
    mockBitrixFetch();
    await installRoute(
      form({ AUTH_ID: 'A', member_id: 'acme', DOMAIN: 'acme.bitrix24.ru', application_token: 'RIGHT' }),
    );
    const res = await handlerRoute(form({ member_id: 'acme', application_token: 'WRONG' }));
    expect(res.status).toBe(401);
  });

  it('ONAPPUNINSTALL deactivates the portal and clears tokens when the application_token matches', async () => {
    mockBitrixFetch();
    await installRoute(
      form({ AUTH_ID: 'A', REFRESH_ID: 'R', member_id: 'acme', DOMAIN: 'acme.bitrix24.ru', application_token: 'APP_TOKEN' }),
    );
    const res = await eventsRoute(
      form({ event: 'ONAPPUNINSTALL', 'auth[member_id]': 'acme', 'auth[application_token]': 'APP_TOKEN' }),
    );
    expect(res.status).toBe(200);
    const portal = await testDb.portalInstallation.findUnique({ where: { memberId: 'acme' } });
    expect(portal?.isActive).toBe(false);
    expect(portal?.authTokenEnc).toBeNull();
  });

  it('ONAPPUNINSTALL without a valid application_token is rejected and changes nothing (ТЗ §42)', async () => {
    mockBitrixFetch();
    await installRoute(
      form({ AUTH_ID: 'A', REFRESH_ID: 'R', member_id: 'acme', DOMAIN: 'acme.bitrix24.ru', application_token: 'APP_TOKEN' }),
    );

    const noToken = await eventsRoute(form({ event: 'ONAPPUNINSTALL', 'auth[member_id]': 'acme' }));
    expect(noToken.status).toBe(401);

    const wrongToken = await eventsRoute(
      form({ event: 'ONAPPUNINSTALL', 'auth[member_id]': 'acme', 'auth[application_token]': 'GUESS' }),
    );
    expect(wrongToken.status).toBe(401);

    const portal = await testDb.portalInstallation.findUnique({ where: { memberId: 'acme' } });
    expect(portal?.isActive).toBe(true);
    expect(portal?.authTokenEnc).toBeTruthy();
  });

  it('refuses installation from a portal outside ALLOWED_PORTAL_MEMBER_IDS', async () => {
    process.env.ALLOWED_PORTAL_MEMBER_IDS = 'authorised-portal-1';
    try {
      const res = await installRoute(
        form({ AUTH_ID: 'A', member_id: 'stranger', DOMAIN: 'stranger.bitrix24.ru', application_token: 'T' }),
      );
      expect(res.status).toBe(403);
      expect(await testDb.portalInstallation.findUnique({ where: { memberId: 'stranger' } })).toBeNull();

      // The authorised portal still installs.
      mockBitrixFetch();
      const ok = await installRoute(
        form({ AUTH_ID: 'A', member_id: 'authorised-portal-1', DOMAIN: 'ours.bitrix24.ru', application_token: 'T' }),
      );
      expect(ok.status).toBe(307);
    } finally {
      delete process.env.ALLOWED_PORTAL_MEMBER_IDS;
    }
  });

  it('handler uses the inbound per-user AUTH_ID directly and never persists it as the portal token (ТЗ §44)', async () => {
    mockBitrixFetch();
    await installRoute(
      form({ AUTH_ID: 'PORTAL_ACCESS', REFRESH_ID: 'R', member_id: 'acme', DOMAIN: 'acme.bitrix24.ru', application_token: 'APP_TOKEN' }),
    );
    const before = await testDb.portalInstallation.findUnique({ where: { memberId: 'acme' } });

    const seen: string[] = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const body = String((init as RequestInit)?.body ?? '');
      const auth = new URLSearchParams(body).get('auth');
      if (auth) seen.push(auth);
      if (String(url).includes('user.admin')) return new Response(JSON.stringify({ result: false }), { status: 200 });
      return new Response(JSON.stringify({ result: { ID: '9', NAME: 'Ева', LAST_NAME: 'Сотрудникова' } }), { status: 200 });
    });

    const res = await handlerRoute(
      form({ member_id: 'acme', application_token: 'APP_TOKEN', AUTH_ID: 'USER_EVA_TOKEN' }),
    );
    expect(res.status).toBe(307);
    // user.current was called with the inbound per-user token, not the stored portal token
    expect(seen).toContain('USER_EVA_TOKEN');

    const after = await testDb.portalInstallation.findUnique({ where: { memberId: 'acme' } });
    expect(after?.authTokenEnc).toBe(before?.authTokenEnc);

    const user = await testDb.appUser.findFirst({ where: { bitrixUserId: '9' } });
    expect(user?.role).toBe('EMPLOYEE');
  });
});
