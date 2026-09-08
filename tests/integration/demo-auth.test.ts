import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb } from '../helpers/db';
import { seedDemoPortal } from '@/lib/demo/seed-data';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { GET as sessionGet } from '@/app/api/session/route';
import { POST as switchRole } from '@/app/api/demo/switch-role/route';

process.env.SESSION_SECRET = 'demo-auth-test-secret-at-least-32-bytes-xx';
process.env.DEMO_MODE = 'true';

async function demoAdminCookie() {
  const { portalId } = await seedDemoPortal(testDb);
  const admin = (await testDb.appUser.findFirst({ where: { portalId, role: 'ADMIN' } }))!;
  const token = await signSession({ portalId, appUserId: admin.id, role: 'ADMIN', demo: true });
  return { portalId, token, adminId: admin.id };
}

function req(method: string, cookie: string, body?: unknown) {
  const headers = new Headers({ cookie, 'content-type': 'application/json', [CSRF_HEADER]: 'x' });
  return new NextRequest('http://localhost/api', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('demo auth', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('GET /api/session returns identity + role', async () => {
    const { token } = await demoAdminCookie();
    const res = await sessionGet(req('GET', `${SESSION_COOKIE}=${token}`));
    const body = await res.json();
    expect(body.role).toBe('ADMIN');
    expect(body.demo).toBe(true);
    expect(body.user.fullName).toBe('Анна Ковалёва');
  });

  it('switch-role re-issues the session for the chosen role', async () => {
    const { token } = await demoAdminCookie();
    const res = await switchRole(
      req('POST', `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=x`, { role: 'EMPLOYEE' }),
    );
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie();
    const sessionCookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie).not.toContain(`${SESSION_COOKIE}=${token}`);
  });

  it('switch-role is forbidden when DEMO_MODE is off', async () => {
    const { token } = await demoAdminCookie();
    process.env.DEMO_MODE = 'false';
    const res = await switchRole(
      req('POST', `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=x`, { role: 'MANAGER' }),
    );
    process.env.DEMO_MODE = 'true';
    expect(res.status).toBe(403);
  });

  it('switch-role rejects an invalid role', async () => {
    const { token } = await demoAdminCookie();
    const res = await switchRole(
      req('POST', `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=x`, { role: 'SUPERUSER' }),
    );
    expect(res.status).toBe(400);
  });
});
