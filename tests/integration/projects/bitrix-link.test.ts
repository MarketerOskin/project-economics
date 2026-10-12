import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { POST } from '@/app/api/projects/[id]/bitrix-link/route';

process.env.SESSION_SECRET = 'bitrix-link-test-secret-at-least-32-bytes-xx';

async function ck(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') {
  const t = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}

function link(id: string, body: unknown, cookie: string) {
  return POST(
    new NextRequest(`http://localhost/api/projects/${id}/bitrix-link`, {
      method: 'POST',
      headers: new Headers({ cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

// Demo mode resolves «Проекты» groups from a canned list (group "11" exists), no Bitrix call.
describe('POST /api/projects/:id/bitrix-link (ADR-035)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'true';
  });
  afterAll(async () => {
    process.env.DEMO_MODE = 'false';
    await testDb.$disconnect();
  });

  async function setup(clientName: string | null = 'ООО «Свой клиент»') {
    const s = await seedPortal({ isDemo: true });
    await testDb.portalInstallation.update({ where: { id: s.portalId }, data: { plan: 'PRO' } });
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'Сделан вручную', clientName } });
    return { s, project };
  }

  it('links a manual project to a «Проекты» group, keeps its name and client, writes history', async () => {
    const { s, project } = await setup();
    const res = await link(project.id, { source: 'BITRIX_PROJECT', bitrixGroupId: '11' }, await ck(s.portalId, s.managerId, 'MANAGER'));
    expect(res.status).toBe(200);

    const saved = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(saved.sourceType).toBe('BITRIX_PROJECT');
    expect(saved.crmEntityId).toBe('11');
    expect(saved.crmEntityUrl).toMatch(/workgroups\/group\/11/);
    expect(saved.name).toBe('Сделан вручную');
    expect(saved.clientName).toBe('ООО «Свой клиент»');

    const audit = await testDb.auditLog.findFirst({ where: { entityId: project.id, action: 'PROJECT_UPDATED' } });
    expect(audit).not.toBeNull();
  });

  it('employee -> 403, project untouched', async () => {
    const { s, project } = await setup();
    const res = await link(project.id, { source: 'BITRIX_PROJECT', bitrixGroupId: '11' }, await ck(s.portalId, s.employeeId, 'EMPLOYEE'));
    expect(res.status).toBe(403);
    expect((await testDb.project.findUniqueOrThrow({ where: { id: project.id } })).sourceType).toBe('MANUAL');
  });

  it('unknown group -> 400, project untouched', async () => {
    const { s, project } = await setup();
    const res = await link(project.id, { source: 'BITRIX_PROJECT', bitrixGroupId: 'nope' }, await ck(s.portalId, s.managerId, 'MANAGER'));
    expect(res.status).toBe(400);
    expect((await testDb.project.findUniqueOrThrow({ where: { id: project.id } })).sourceType).toBe('MANUAL');
  });

  it('a CRM type that is not a configured source -> 400', async () => {
    const { s, project } = await setup();
    const res = await link(project.id, { source: 'BITRIX_CRM', crmEntityTypeId: 1234, crmEntityId: '5' }, await ck(s.portalId, s.managerId, 'MANAGER'));
    expect(res.status).toBe(400);
  });

  it("another portal's project -> 404", async () => {
    const { project } = await setup();
    const other = await seedPortal({ isDemo: true });
    const res = await link(project.id, { source: 'BITRIX_PROJECT', bitrixGroupId: '11' }, await ck(other.portalId, other.managerId, 'MANAGER'));
    expect(res.status).toBe(404);
  });
});
