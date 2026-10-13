import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { GET as getRoute, PUT as putRoute } from '@/app/api/brand/route';
import { GET as logoRoute } from '@/app/api/brand/logo/route';

process.env.SESSION_SECRET = 'brand-api-test-secret-at-least-32-bytes-xx';

type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
async function ck(portalId: string, userId: string, role: Role) {
  const token = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=t`;
}
function req(url: string, o: { method?: string; cookie: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: o.method ?? 'GET',
    headers: new Headers({
      cookie: o.cookie,
      'content-type': 'application/json',
      [CSRF_HEADER]: 't',
    }),
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
}
// 1×1 transparent PNG.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('report branding API (ADR-054)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('admin saves name, colour and logo; the logo is served only to its own portal', async () => {
    const s = await seedPortal();
    const admin = await ck(s.portalId, s.adminId, 'ADMIN');
    const res = await putRoute(
      req('/api/brand', {
        method: 'PUT',
        cookie: admin,
        body: {
          companyName: 'ООО «Ромашка»',
          accentColor: '#3F6212',
          requisites: 'ИНН 1',
          logo: PNG,
        },
      }),
    );
    expect(res.status).toBe(200);
    const saved = (await res.json()) as {
      companyName: string;
      accentColor: string;
      logoUrl: string | null;
    };
    expect(saved.companyName).toBe('ООО «Ромашка»');
    expect(saved.accentColor).toBe('#3f6212');
    expect(saved.logoUrl).toMatch(/^\/api\/brand\/logo\?v=\d+$/);

    const employee = await ck(s.portalId, s.employeeId, 'EMPLOYEE');
    const logo = await logoRoute(req('/api/brand/logo', { cookie: employee }));
    expect(logo.status).toBe(200);
    expect(logo.headers.get('content-type')).toBe('image/png');

    const other = await seedPortal();
    const foreign = await logoRoute(
      req('/api/brand/logo', { cookie: await ck(other.portalId, other.adminId, 'ADMIN') }),
    );
    expect(foreign.status).toBe(404);
  });

  it('keeps the logo when it is not sent and removes it on null', async () => {
    const s = await seedPortal();
    const admin = await ck(s.portalId, s.adminId, 'ADMIN');
    await putRoute(
      req('/api/brand', { method: 'PUT', cookie: admin, body: { companyName: 'A', logo: PNG } }),
    );
    const kept = await (
      await putRoute(
        req('/api/brand', { method: 'PUT', cookie: admin, body: { companyName: 'B' } }),
      )
    ).json();
    expect(kept.logoUrl).not.toBeNull();
    const removed = await (
      await putRoute(
        req('/api/brand', { method: 'PUT', cookie: admin, body: { companyName: 'B', logo: null } }),
      )
    ).json();
    expect(removed.logoUrl).toBeNull();
  });

  it('rejects a non-image logo and non-admins', async () => {
    const s = await seedPortal();
    const admin = await ck(s.portalId, s.adminId, 'ADMIN');
    const svg = `data:image/png;base64,${Buffer.from('<svg onload="alert(1)"/>').toString('base64')}`;
    const bad = await putRoute(
      req('/api/brand', { method: 'PUT', cookie: admin, body: { logo: svg } }),
    );
    expect(bad.status).toBe(400);

    const employee = await ck(s.portalId, s.employeeId, 'EMPLOYEE');
    const denied = await putRoute(
      req('/api/brand', { method: 'PUT', cookie: employee, body: { companyName: 'X' } }),
    );
    expect(denied.status).toBe(403);
    const read = await getRoute(req('/api/brand', { cookie: employee }));
    expect(read.status).toBe(200);
  });
});
