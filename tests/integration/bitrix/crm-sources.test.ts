import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { encryptToken } from '@/lib/bitrix/crypto';
import { GET as crmRoute } from '@/app/api/crm/route';
import { POST as createProjectRoute } from '@/app/api/projects/route';
import { GET as listSourcesRoute, POST as addSourceRoute } from '@/app/api/crm/sources/route';
import { DELETE as removeSourceRoute } from '@/app/api/crm/sources/[id]/route';
import { GET as addableTypesRoute } from '@/app/api/crm/smart-process-types/route';

process.env.SESSION_SECRET = 'crm-sources-test-secret-at-least-32-bytes-xx';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const WORK_ON_PROJECTS_ENTITY_TYPE_ID = 1068;

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
const P = (id: string) => ({ params: Promise.resolve({ id }) });

async function connectPortal(portalId: string) {
  await testDb.portalInstallation.update({
    where: { id: portalId },
    // PRO too — these tests exercise CRM import itself, not the Pro gate on top of it.
    data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
  });
}

function mockCrmTypeList(types: Array<{ id: number; title: string; entityTypeId: number }>) {
  vi.spyOn(global, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ result: { types } }), { status: 200 }),
  );
}

describe('CRM import sources (ADR-026)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('a fresh portal has Deal + Company built in, nothing else', async () => {
    const s = await seedPortal();
    const res = await listSourcesRoute(req('/api/crm/sources', { cookie: await ck(s.portalId, s.managerId, 'MANAGER') }));
    const { sources } = await res.json();
    expect(sources).toEqual([
      { entityTypeId: 2, label: 'Сделки', removable: false, id: null },
      { entityTypeId: 4, label: 'Компании', removable: false, id: null },
    ]);
  });

  it('non-admin cannot list addable Smart Processes or add/remove a source', async () => {
    const s = await seedPortal();
    await connectPortal(s.portalId);
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');

    expect((await addableTypesRoute(req('/api/crm/smart-process-types', { cookie }))).status).toBe(403);
    expect(
      (
        await addSourceRoute(
          req('/api/crm/sources', { method: 'POST', cookie, body: { entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID } }),
        )
      ).status,
    ).toBe(403);
    expect((await removeSourceRoute(req('/api/crm/sources/x', { method: 'DELETE', cookie }), P('x'))).status).toBe(403);
  });

  it('admin adds a real Smart Process as a source, and it disappears from the addable list', async () => {
    const s = await seedPortal();
    await connectPortal(s.portalId);
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');

    mockCrmTypeList([{ id: 9, title: 'Работа по проектам', entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID }]);
    const addRes = await addSourceRoute(
      req('/api/crm/sources', { method: 'POST', cookie, body: { entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID } }),
    );
    expect(addRes.status).toBe(201);

    const listRes = await listSourcesRoute(req('/api/crm/sources', { cookie }));
    const { sources } = await listRes.json();
    expect(sources).toContainEqual({
      entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID,
      label: 'Работа по проектам',
      removable: true,
      id: expect.any(String),
    });

    mockCrmTypeList([{ id: 9, title: 'Работа по проектам', entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID }]);
    const addableRes = await addableTypesRoute(req('/api/crm/smart-process-types', { cookie }));
    const { types } = await addableRes.json();
    expect(types).toEqual([]);
  });

  it('rejects adding an entityTypeId that is not a real Smart Process on this portal', async () => {
    const s = await seedPortal();
    await connectPortal(s.portalId);
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');

    mockCrmTypeList([]);
    const res = await addSourceRoute(
      req('/api/crm/sources', { method: 'POST', cookie, body: { entityTypeId: 9999 } }),
    );
    expect(res.status).toBe(400);
  });

  it('admin removes a configured Smart Process source; built-ins have no id to remove', async () => {
    const s = await seedPortal();
    await connectPortal(s.portalId);
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');

    mockCrmTypeList([{ id: 9, title: 'Работа по проектам', entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID }]);
    await addSourceRoute(
      req('/api/crm/sources', { method: 'POST', cookie, body: { entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID } }),
    );
    const created = await testDb.crmImportSource.findFirstOrThrow({ where: { portalId: s.portalId } });

    const delRes = await removeSourceRoute(req(`/api/crm/sources/${created.id}`, { method: 'DELETE', cookie }), P(created.id));
    expect(delRes.status).toBe(200);

    const listRes = await listSourcesRoute(req('/api/crm/sources', { cookie }));
    const { sources } = await listRes.json();
    expect(sources.map((x: { entityTypeId: number }) => x.entityTypeId)).toEqual([2, 4]);
  });

  it('removing an unknown source id 404s', async () => {
    const s = await seedPortal();
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');
    const res = await removeSourceRoute(req('/api/crm/sources/does-not-exist', { method: 'DELETE', cookie }), P('does-not-exist'));
    expect(res.status).toBe(404);
  });

  it('/api/crm rejects browsing an entityTypeId that was never configured as a source', async () => {
    const s = await seedPortal();
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');
    const res = await crmRoute(req(`/api/crm?entityTypeId=${WORK_ON_PROJECTS_ENTITY_TYPE_ID}`, { cookie }));
    expect(res.status).toBe(400);
  });

  it('/api/crm browses a Smart Process once it has been added as a source', async () => {
    const s = await seedPortal();
    await connectPortal(s.portalId);
    const adminCookie = await ck(s.portalId, s.adminId, 'ADMIN');

    mockCrmTypeList([{ id: 9, title: 'Работа по проектам', entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID }]);
    await addSourceRoute(
      req('/api/crm/sources', { method: 'POST', cookie: adminCookie, body: { entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID } }),
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { items: [{ id: 7, title: 'Проект №7' }] } }), { status: 200 }),
    );
    const managerCookie = await ck(s.portalId, s.managerId, 'MANAGER');
    const res = await crmRoute(req(`/api/crm?entityTypeId=${WORK_ON_PROJECTS_ENTITY_TYPE_ID}`, { cookie: managerCookie }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0]).toMatchObject({ id: '7', title: 'Проект №7', entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID });
  });

  it('creating a project from a configured Smart Process stores crmEntityType SMART_PROCESS', async () => {
    const s = await seedPortal();
    await connectPortal(s.portalId);
    const adminCookie = await ck(s.portalId, s.adminId, 'ADMIN');

    mockCrmTypeList([{ id: 9, title: 'Работа по проектам', entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID }]);
    await addSourceRoute(
      req('/api/crm/sources', { method: 'POST', cookie: adminCookie, body: { entityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID } }),
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { item: { id: 7, title: 'Проект №7' } } }), { status: 200 }),
    );
    const res = await createProjectRoute(
      req('/api/projects', {
        method: 'POST',
        cookie: adminCookie,
        body: { name: 'temp', source: 'BITRIX_CRM', crmEntityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID, crmEntityId: '7' },
      }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const project = await testDb.project.findUnique({ where: { id } });
    expect(project?.crmEntityType).toBe('SMART_PROCESS');
    expect(project?.crmEntityUrl).toMatch(new RegExp(`crm/type/${WORK_ON_PROJECTS_ENTITY_TYPE_ID}/details/7`));
  });

  it('rejects creating a project from an entityTypeId not configured as a source', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({ where: { id: s.portalId }, data: { plan: 'PRO' } });
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');
    const res = await createProjectRoute(
      req('/api/projects', {
        method: 'POST',
        cookie,
        body: { name: 'temp', source: 'BITRIX_CRM', crmEntityTypeId: WORK_ON_PROJECTS_ENTITY_TYPE_ID, crmEntityId: '7' },
      }),
    );
    expect(res.status).toBe(400);
  });
});
