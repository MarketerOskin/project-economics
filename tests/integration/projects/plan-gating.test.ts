import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { POST as createRoute } from '@/app/api/projects/route';

process.env.SESSION_SECRET = 'plan-gating-test-secret-at-least-32-bytes-xx';

async function ctx(portalId: string, userId: string) {
  const token = await signSession({ portalId, appUserId: userId, role: 'MANAGER', demo: false });
  return `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=t`;
}

function req(body: unknown, cookie: string) {
  return new NextRequest('http://localhost/api/projects', {
    method: 'POST',
    headers: new Headers({ cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: JSON.stringify(body),
  });
}

describe('project creation — plan gating (ТЗ: free tier limits)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('FREE: no project-count limit — the free part is a real working product', async () => {
    const s = await seedPortal();
    const cookie = await ctx(s.portalId, s.managerId);

    for (let i = 0; i < 6; i++) {
      const res = await createRoute(req({ name: `Проект ${i + 1}` }, cookie));
      expect(res.status).toBe(201);
    }
    expect(await testDb.project.count({ where: { portalId: s.portalId } })).toBe(6);
  });

  it('FREE: rejects importing a project from Bitrix24 CRM (403, names the feature)', async () => {
    const s = await seedPortal();
    const cookie = await ctx(s.portalId, s.managerId);

    const res = await createRoute(
      req({ name: 'Импорт', source: 'BITRIX_CRM', crmEntityTypeId: 2, crmEntityId: '999' }, cookie),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toContain('Pro');
    expect(await testDb.project.count({ where: { portalId: s.portalId } })).toBe(0);
  });

  it('PRO: CRM-source is accepted (gate passes before CRM lookup)', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({ where: { id: s.portalId }, data: { plan: 'PRO' } });
    const cookie = await ctx(s.portalId, s.managerId);

    // source=BITRIX_CRM without crmEntityTypeId/crmEntityId just skips the CRM lookup —
    // this only proves the plan gate itself doesn't block a PRO portal.
    const crmRes = await createRoute(req({ name: 'Из CRM', source: 'BITRIX_CRM' }, cookie));
    expect(crmRes.status).toBe(201);
  });

  it('PRO with an expired grant behaves as FREE (CRM import blocked again)', async () => {
    const s = await seedPortal();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { plan: 'PRO', planExpiresAt: past },
    });
    const cookie = await ctx(s.portalId, s.managerId);

    const res = await createRoute(req({ name: 'Импорт', source: 'BITRIX_CRM' }, cookie));
    expect(res.status).toBe(403);
  });
});
