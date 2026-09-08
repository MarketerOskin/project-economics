import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { encryptToken } from '@/lib/bitrix/crypto';
import { GET as crmRoute } from '@/app/api/crm/route';
import { POST as createProjectRoute } from '@/app/api/projects/route';

process.env.SESSION_SECRET = 'crm-test-secret-at-least-32-bytes-xxxxxxxxx';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

async function ck(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER') {
  const t = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}
const req = (url: string, o: { method?: string; cookie: string; body?: unknown }) =>
  new NextRequest(`http://localhost${url}`, {
    method: o.method ?? 'GET',
    headers: new Headers({ cookie: o.cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });

describe('CRM browse + import (ТЗ §8)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('demo mode returns a canned CRM list so the UI works without a portal', async () => {
    process.env.DEMO_MODE = 'true';
    const s = await seedPortal({ isDemo: true });
    const res = await crmRoute(req('/api/crm?entityTypeId=2', { cookie: await ck(s.portalId, s.managerId, 'MANAGER') }));
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].url).toMatch(/crm\/deal\/details/);
  });

  it('production mode normalises crm.item.list results', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/' },
    });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { items: [{ id: 55, title: 'Сделка №55' }] } }), { status: 200 }),
    );
    const res = await crmRoute(req('/api/crm?entityTypeId=2', { cookie: await ck(s.portalId, s.managerId, 'MANAGER') }));
    const body = await res.json();
    expect(body.items).toEqual([
      { id: '55', title: 'Сделка №55', clientName: null, url: 'https://test.bitrix24.ru/crm/deal/details/55/', entityTypeId: 2 },
    ]);
  });

  it('creating a project from a Deal stores the snapshot + valid Bitrix URL', async () => {
    process.env.DEMO_MODE = 'true';
    const s = await seedPortal({ isDemo: true });
    const res = await createProjectRoute(
      req('/api/projects', {
        method: 'POST',
        cookie: await ck(s.portalId, s.managerId, 'MANAGER'),
        body: { name: 'temp', source: 'BITRIX_CRM', crmEntityTypeId: 2, crmEntityId: '101' },
      }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const project = await testDb.project.findUnique({ where: { id } });
    expect(project?.sourceType).toBe('BITRIX_CRM');
    expect(project?.crmEntityType).toBe('DEAL');
    expect(project?.crmEntityUrl).toMatch(/crm\/deal\/details\/101/);
    expect(project?.clientName).toBe('ООО «Ортис»');
  });
});
