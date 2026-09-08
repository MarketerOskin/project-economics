import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { route } from '@/server/handler';
import { signSession } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';

const SECRET = 'handler-test-secret-at-least-32-bytes-xxxxxx';
process.env.SESSION_SECRET = SECRET;

async function cookieFor(portalId: string, appUserId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') {
  const token = await signSession({ portalId, appUserId, role, demo: false });
  return `${SESSION_COOKIE}=${token}`;
}

function makeRequest(opts: { method?: string; cookie?: string; csrfHeader?: string }) {
  const headers = new Headers();
  if (opts.cookie) headers.set('cookie', opts.cookie);
  if (opts.csrfHeader) headers.set(CSRF_HEADER, opts.csrfHeader);
  return new NextRequest('http://localhost/api/test', { method: opts.method ?? 'GET', headers });
}

describe('route() pipeline', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('401 when auth required and no session', async () => {
    const handler = route(async () => ({ ok: true }));
    const res = await handler(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it('200 with a valid session, exposing the resolved actor', async () => {
    const s = await seedPortal();
    const handler = route<{ x: string }>(async ({ session }) => ({ role: session.actor.role }));
    const res = await handler(
      makeRequest({ cookie: await cookieFor(s.portalId, s.managerId, 'MANAGER') }),
      { params: Promise.resolve({ x: '1' }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: 'MANAGER' });
  });

  it('ignores a forged role claim — role comes from the DB', async () => {
    const s = await seedPortal();
    // employee user, but cookie claims ADMIN
    const token = await signSession({
      portalId: s.portalId,
      appUserId: s.employeeId,
      role: 'ADMIN',
      demo: false,
    });
    const handler = route(async ({ session }) => ({ role: session.actor.role }));
    const res = await handler(makeRequest({ cookie: `${SESSION_COOKIE}=${token}` }));
    expect(await res.json()).toEqual({ role: 'EMPLOYEE' });
  });

  it('403 on a mutating request without the CSRF token', async () => {
    const s = await seedPortal();
    const handler = route(async () => ({ ok: true }));
    const res = await handler(
      makeRequest({ method: 'POST', cookie: await cookieFor(s.portalId, s.adminId, 'ADMIN') }),
    );
    expect(res.status).toBe(403);
  });

  it('passes when the CSRF cookie and header match', async () => {
    const s = await seedPortal();
    const handler = route(async () => ({ ok: true }));
    const res = await handler(
      makeRequest({
        method: 'POST',
        cookie: `${await cookieFor(s.portalId, s.adminId, 'ADMIN')}; ${CSRF_COOKIE}=tok123`,
        csrfHeader: 'tok123',
      }),
    );
    expect(res.status).toBe(200);
  });

  it('maps a thrown AppError to its status', async () => {
    const s = await seedPortal();
    const { forbidden } = await import('@/lib/errors');
    const handler = route(async () => {
      throw forbidden('нет доступа');
    });
    const res = await handler(makeRequest({ cookie: await cookieFor(s.portalId, s.adminId, 'ADMIN') }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.message).toBe('нет доступа');
  });
});
