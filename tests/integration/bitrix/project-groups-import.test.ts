import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { encryptToken } from '@/lib/bitrix/crypto';
import { GET as groupsRoute } from '@/app/api/bitrix-groups/route';
import { POST as createProjectRoute } from '@/app/api/projects/route';

process.env.SESSION_SECRET = 'project-groups-test-secret-at-least-32-bytes';
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

describe('Importing a project from Bitrix24\'s native "Проекты" module (ADR-031)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('demo mode browses a canned list of project groups', async () => {
    process.env.DEMO_MODE = 'true';
    const s = await seedPortal({ isDemo: true });
    const res = await groupsRoute(req('/api/bitrix-groups', { cookie: await ck(s.portalId, s.managerId, 'MANAGER') }));
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].url).toMatch(/workgroups\/group/);
  });

  it('production mode normalises sonet_group.get results', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/' },
    });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [{ ID: '11', NAME: 'Запуск склада' }] }), { status: 200 }),
    );
    const res = await groupsRoute(req('/api/bitrix-groups', { cookie: await ck(s.portalId, s.managerId, 'MANAGER') }));
    const body = await res.json();
    expect(body.items).toEqual([{ id: '11', title: 'Запуск склада', url: 'https://test.bitrix24.ru/workgroups/group/11/' }]);
  });

  it('creating a project from a Bitrix project group requires Pro', async () => {
    process.env.DEMO_MODE = 'true';
    const s = await seedPortal({ isDemo: false });
    const res = await createProjectRoute(
      req('/api/projects', {
        method: 'POST',
        cookie: await ck(s.portalId, s.managerId, 'MANAGER'),
        body: { name: 'temp', source: 'BITRIX_PROJECT', bitrixGroupId: '11' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('creating a project from a Bitrix project group stores the snapshot (demo)', async () => {
    process.env.DEMO_MODE = 'true';
    const s = await seedPortal({ isDemo: true });
    const res = await createProjectRoute(
      req('/api/projects', {
        method: 'POST',
        cookie: await ck(s.portalId, s.managerId, 'MANAGER'),
        body: { name: 'temp', source: 'BITRIX_PROJECT', bitrixGroupId: '11' },
      }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const project = await testDb.project.findUnique({ where: { id } });
    expect(project?.sourceType).toBe('BITRIX_PROJECT');
    expect(project?.crmEntityType).toBeNull();
    expect(project?.crmEntityId).toBe('11');
    expect(project?.crmEntityUrl).toMatch(/workgroups\/group\/11/);
  });

  it('rejects a bitrixGroupId that Bitrix24 does not recognise', async () => {
    process.env.DEMO_MODE = 'true';
    const s = await seedPortal({ isDemo: true });
    const res = await createProjectRoute(
      req('/api/projects', {
        method: 'POST',
        cookie: await ck(s.portalId, s.managerId, 'MANAGER'),
        body: { name: 'temp', source: 'BITRIX_PROJECT', bitrixGroupId: 'does-not-exist' },
      }),
    );
    expect(res.status).toBe(400);
  });
});
