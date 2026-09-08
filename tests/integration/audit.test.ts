import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { GET as auditRoute } from '@/app/api/audit/route';

process.env.SESSION_SECRET = 'audit-test-secret-at-least-32-bytes-xxxxxxx';

async function cookie(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') {
  const t = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${t}`;
}
const req = (url: string, ck: string) =>
  new NextRequest(`http://localhost${url}`, { headers: new Headers({ cookie: ck }) });

describe('audit API (ТЗ §32)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function setup() {
    const s = await seedPortal();
    const project = await testDb.project.create({
      data: {
        portalId: s.portalId,
        name: 'Альфа',
        members: { create: { portalId: s.portalId, userId: s.employeeId } },
      },
    });
    await testDb.auditLog.create({
      data: {
        portalId: s.portalId,
        actorId: s.managerId,
        actorName: 'Менеджер Тестовый',
        action: 'FINANCE_UPDATED',
        entityType: 'FINANCIAL_ENTRY',
        entityId: 'e1',
        projectId: project.id,
        before: { amount: '25000', direction: 'EXPENSE' },
        after: { amount: '32000', direction: 'EXPENSE' },
      },
    });
    return { s, project };
  }

  it('global history: employee -> 403, manager -> 200 with humanized entries', async () => {
    const { s } = await setup();
    expect((await auditRoute(req('/api/audit', await cookie(s.portalId, s.employeeId, 'EMPLOYEE')))).status).toBe(403);

    const res = await auditRoute(req('/api/audit', await cookie(s.portalId, s.managerId, 'MANAGER')));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries[0].sentence).toBe('изменил расход проекта «Альфа»');
    expect(body.entries[0].change).toMatch(/→/);
    expect(JSON.stringify(body)).not.toMatch(/"before":/); // no raw audit JSON leaked
  });

  it('project history: a member employee can read it', async () => {
    const { s, project } = await setup();
    const res = await auditRoute(
      req(`/api/audit?projectId=${project.id}`, await cookie(s.portalId, s.employeeId, 'EMPLOYEE')),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).total).toBe(1);
  });

  it('project history: a non-member employee -> 403', async () => {
    const { s } = await setup();
    const other = await testDb.project.create({ data: { portalId: s.portalId, name: 'Чужой' } });
    const res = await auditRoute(
      req(`/api/audit?projectId=${other.id}`, await cookie(s.portalId, s.employeeId, 'EMPLOYEE')),
    );
    expect(res.status).toBe(403);
  });
});
