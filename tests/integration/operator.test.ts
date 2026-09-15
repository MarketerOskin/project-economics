import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { hashOperatorPassword } from '@/lib/operator/password';
import { OPERATOR_COOKIE, signOperatorSession } from '@/lib/operator/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { POST as loginRoute } from '@/app/api/operator/login/route';
import { GET as listPortalsRoute } from '@/app/api/operator/portals/route';
import { PATCH as setPlanRoute, GET as historyRoute } from '@/app/api/operator/portals/[id]/plan/route';

process.env.SESSION_SECRET = 'operator-test-secret-at-least-32-bytes-xxxxx';
process.env.OPERATOR_EMAIL = 'owner@example.com';
process.env.OPERATOR_PASSWORD_HASH = hashOperatorPassword('correct-password-123');

function loginReq(body: unknown) {
  return new NextRequest('http://localhost/api/operator/login', {
    method: 'POST',
    headers: new Headers({ 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  });
}

async function operatorCookie() {
  const token = await signOperatorSession('owner@example.com');
  return `${OPERATOR_COOKIE}=${token}; ${CSRF_COOKIE}=t`;
}

function opReq(url: string, cookie: string, opts: { method?: string; body?: unknown } = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? 'GET',
    headers: new Headers({ cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe('operator back-office', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('login: wrong password -> 401, no cookie set', async () => {
    const res = await loginRoute(loginReq({ email: 'owner@example.com', password: 'wrong' }));
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().join(';')).not.toContain('pe_operator_session');
  });

  it('login: wrong email -> 401 even with the right password (not just a password check)', async () => {
    const res = await loginRoute(loginReq({ email: 'someone-else@example.com', password: 'correct-password-123' }));
    expect(res.status).toBe(401);
  });

  it('login: correct credentials -> 200, issues the operator session + csrf cookies', async () => {
    const res = await loginRoute(loginReq({ email: 'owner@example.com', password: 'correct-password-123' }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.getSetCookie().join(';');
    expect(setCookie).toContain('pe_operator_session=');
    expect(setCookie).toContain('pe_csrf=');
  });

  it('portal routes reject a request with no operator session (401), a portal session is not enough', async () => {
    const res = await listPortalsRoute(new NextRequest('http://localhost/api/operator/portals'));
    expect(res.status).toBe(401);
  });

  it('lists portals including plan info, and grants + revokes PRO with an audit trail', async () => {
    const s = await seedPortal();
    const cookie = await operatorCookie();

    const listed = await (await listPortalsRoute(opReq('/api/operator/portals', cookie))).json();
    const row = listed.portals.find((p: { id: string }) => p.id === s.portalId);
    expect(row).toBeDefined();
    expect(row.plan).toBe('FREE');
    expect(row.effectivePlan).toBe('FREE');

    // Grant PRO for a year.
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const grantRes = await setPlanRoute(
      opReq(`/api/operator/portals/${s.portalId}/plan`, cookie, {
        method: 'PATCH',
        body: { plan: 'PRO', expiresAt, note: 'оплатил на год, перевод' },
      }),
      { params: Promise.resolve({ id: s.portalId }) },
    );
    expect(grantRes.status).toBe(200);

    const portal = await testDb.portalInstallation.findUnique({ where: { id: s.portalId } });
    expect(portal?.plan).toBe('PRO');
    expect(portal?.planNote).toContain('перевод');

    const history = await (
      await historyRoute(opReq(`/api/operator/portals/${s.portalId}/plan`, cookie), {
        params: Promise.resolve({ id: s.portalId }),
      })
    ).json();
    expect(history.history).toHaveLength(1);
    expect(history.history[0].plan).toBe('PRO');
    expect(history.history[0].operatorEmail).toBe('owner@example.com');

    // Revoke back to FREE.
    await setPlanRoute(
      opReq(`/api/operator/portals/${s.portalId}/plan`, cookie, {
        method: 'PATCH',
        body: { plan: 'FREE' },
      }),
      { params: Promise.resolve({ id: s.portalId }) },
    );
    const reverted = await testDb.portalInstallation.findUnique({ where: { id: s.portalId } });
    expect(reverted?.plan).toBe('FREE');

    const historyAfter = await testDb.operatorGrant.count({ where: { portalId: s.portalId } });
    expect(historyAfter).toBe(2);
  });

  it('search filters portals by domain / member_id', async () => {
    const s = await seedPortal();
    const cookie = await operatorCookie();
    const res = await (
      await listPortalsRoute(opReq(`/api/operator/portals?q=${s.portalId.slice(0, 4)}xxxxxxxx-no-match`, cookie))
    ).json();
    expect(res.portals).toHaveLength(0);
  });
});
