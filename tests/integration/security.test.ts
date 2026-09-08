import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { _resetRateLimit } from '@/lib/rate-limit';
import { encryptToken } from '@/lib/bitrix/crypto';
import { GET as sessionRoute } from '@/app/api/session/route';
import { POST as createProjectRoute } from '@/app/api/projects/route';
import { GET as projectGet } from '@/app/api/projects/[id]/route';

process.env.SESSION_SECRET = 'security-test-secret-at-least-32-bytes-xxx';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const P = (id: string) => ({ params: Promise.resolve({ id }) });
function req(url: string, o: { method?: string; cookie?: string; body?: unknown } = {}) {
  const h = new Headers({ 'content-type': 'application/json', [CSRF_HEADER]: 't' });
  if (o.cookie) h.set('cookie', o.cookie);
  return new NextRequest(`http://localhost${url}`, {
    method: o.method ?? 'GET',
    headers: h,
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
}

describe('security invariants (ТЗ §42, §44)', () => {
  beforeEach(async () => {
    await resetDb();
    _resetRateLimit();
  });
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('a cookie for a non-existent user is rejected (401)', async () => {
    const s = await seedPortal();
    const token = await signSession({ portalId: s.portalId, appUserId: 'ghost', role: 'ADMIN', demo: false });
    const res = await sessionRoute(req('/api/session', { cookie: `${SESSION_COOKIE}=${token}` }));
    expect(res.status).toBe(401);
  });

  it('a forged ADMIN cookie for an EMPLOYEE user still cannot hit an admin-only mutation', async () => {
    const s = await seedPortal();
    const forged = await signSession({ portalId: s.portalId, appUserId: s.employeeId, role: 'ADMIN', demo: false });
    const res = await createProjectRoute(
      req('/api/projects', { method: 'POST', cookie: `${SESSION_COOKIE}=${forged}; ${CSRF_COOKIE}=t`, body: { name: 'X' } }),
    );
    expect(res.status).toBe(403);
  });

  it('no response body ever contains a stored token', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('SUPERSECRET'), refreshTokenEnc: encryptToken('SUPERREFRESH') },
    });
    const token = await signSession({ portalId: s.portalId, appUserId: s.adminId, role: 'ADMIN', demo: false });
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });

    const bodies = await Promise.all([
      sessionRoute(req('/api/session', { cookie: `${SESSION_COOKIE}=${token}` })).then((r) => r.text()),
      projectGet(req(`/api/projects/${project.id}`, { cookie: `${SESSION_COOKIE}=${token}` }), P(project.id)).then((r) => r.text()),
    ]);
    for (const b of bodies) {
      expect(b).not.toContain('SUPERSECRET');
      expect(b).not.toContain('SUPERREFRESH');
      expect(b).not.toMatch(/authTokenEnc|refreshTokenEnc/);
    }
  });

  it('a POST with no CSRF token is 403', async () => {
    const s = await seedPortal();
    const token = await signSession({ portalId: s.portalId, appUserId: s.adminId, role: 'ADMIN', demo: false });
    const noCsrf = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      headers: new Headers({ cookie: `${SESSION_COOKIE}=${token}`, 'content-type': 'application/json' }),
      body: JSON.stringify({ name: 'X' }),
    });
    expect((await createProjectRoute(noCsrf)).status).toBe(403);
  });

  it('rapid mutations are rate-limited with 429', async () => {
    const s = await seedPortal();
    const token = await signSession({ portalId: s.portalId, appUserId: s.adminId, role: 'ADMIN', demo: false });
    const cookie = `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=t`;

    let sawLimit = false;
    for (let i = 0; i < 40; i++) {
      const res = await createProjectRoute(
        req('/api/projects', { method: 'POST', cookie, body: { name: `P${i}` } }),
      );
      if (res.status === 429) {
        sawLimit = true;
        break;
      }
    }
    expect(sawLimit).toBe(true);
  });
});
