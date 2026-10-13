import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { GET as listRoute, POST as createRoute } from '@/app/api/projects/route';
import { DELETE as deleteRoute, GET as getRoute, PATCH as patchRoute } from '@/app/api/projects/[id]/route';
import { POST as archiveRoute } from '@/app/api/projects/[id]/archive/route';
import { PUT as membersRoute } from '@/app/api/projects/[id]/members/route';

process.env.SESSION_SECRET = 'projects-api-test-secret-at-least-32-bytes';

type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

async function ctx(portalId: string, userId: string, role: Role) {
  const token = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=t`;
}

function mkReq(url: string, opts: { method?: string; cookie: string; body?: unknown } = { cookie: '' }) {
  const headers = new Headers({ cookie: opts.cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' });
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const P = (id: string) => ({ params: Promise.resolve({ id }) });

describe('projects API — permissions (ТЗ §66)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function setup() {
    const s = await seedPortal();
    const projectA = await testDb.project.create({
      data: {
        portalId: s.portalId,
        name: 'Проект A',
        members: { create: { portalId: s.portalId, userId: s.employeeId } },
      },
    });
    const projectB = await testDb.project.create({ data: { portalId: s.portalId, name: 'Проект B' } });
    return { s, projectA, projectB };
  }

  it('employee GET own project -> 200', async () => {
    const { s, projectA } = await setup();
    const res = await getRoute(mkReq(`/api/projects/${projectA.id}`, { cookie: await ctx(s.portalId, s.employeeId, 'EMPLOYEE') }), P(projectA.id));
    expect(res.status).toBe(200);
  });

  it('employee GET foreign project -> 403', async () => {
    const { s, projectB } = await setup();
    const res = await getRoute(mkReq(`/api/projects/${projectB.id}`, { cookie: await ctx(s.portalId, s.employeeId, 'EMPLOYEE') }), P(projectB.id));
    expect(res.status).toBe(403);
  });

  it('manager GET any project -> 200', async () => {
    const { s, projectB } = await setup();
    const res = await getRoute(mkReq(`/api/projects/${projectB.id}`, { cookie: await ctx(s.portalId, s.managerId, 'MANAGER') }), P(projectB.id));
    expect(res.status).toBe(200);
  });

  it('employee list returns only member projects', async () => {
    const { s } = await setup();
    const res = await listRoute(mkReq('/api/projects?status=ALL', { cookie: await ctx(s.portalId, s.employeeId, 'EMPLOYEE') }));
    const body = await res.json();
    expect(body.projects.map((p: { name: string }) => p.name)).toEqual(['Проект A']);
  });

  it('employee POST project -> 403', async () => {
    const { s } = await setup();
    const res = await createRoute(mkReq('/api/projects', { method: 'POST', cookie: await ctx(s.portalId, s.employeeId, 'EMPLOYEE'), body: { name: 'X' } }));
    expect(res.status).toBe(403);
  });

  it('manager POST project -> 201 and writes an audit row', async () => {
    const { s } = await setup();
    const res = await createRoute(mkReq('/api/projects', { method: 'POST', cookie: await ctx(s.portalId, s.managerId, 'MANAGER'), body: { name: 'Новый проект', memberIds: [s.employeeId] } }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const audit = await testDb.auditLog.findFirst({ where: { entityId: id, action: 'PROJECT_CREATED' } });
    expect(audit).not.toBeNull();
    const members = await testDb.projectMember.count({ where: { projectId: id } });
    expect(members).toBe(1);
  });

  it('cross-portal id -> 404', async () => {
    const a = await seedPortal();
    const b = await seedPortal();
    const projB = await testDb.project.create({ data: { portalId: b.portalId, name: 'B only' } });
    const res = await getRoute(mkReq(`/api/projects/${projB.id}`, { cookie: await ctx(a.portalId, a.adminId, 'ADMIN') }), P(projB.id));
    expect(res.status).toBe(404);
  });

  it('PATCH records changedFields in the audit row', async () => {
    const { s, projectA } = await setup();
    await patchRoute(mkReq(`/api/projects/${projectA.id}`, { method: 'PATCH', cookie: await ctx(s.portalId, s.managerId, 'MANAGER'), body: { name: 'Проект A (ред.)' } }), P(projectA.id));
    const audit = await testDb.auditLog.findFirst({ where: { entityId: projectA.id, action: 'PROJECT_UPDATED' } });
    expect(audit?.changedFields).toContain('name');
  });

  it('archive then restore flips status and logs both', async () => {
    const { s, projectA } = await setup();
    const cookie = await ctx(s.portalId, s.managerId, 'MANAGER');
    await archiveRoute(mkReq(`/api/projects/${projectA.id}/archive`, { method: 'POST', cookie, body: { archived: true } }), P(projectA.id));
    let p = await testDb.project.findUnique({ where: { id: projectA.id } });
    expect(p?.status).toBe('ARCHIVED');
    await archiveRoute(mkReq(`/api/projects/${projectA.id}/archive`, { method: 'POST', cookie, body: { archived: false } }), P(projectA.id));
    p = await testDb.project.findUnique({ where: { id: projectA.id } });
    expect(p?.status).toBe('ACTIVE');
    const actions = (await testDb.auditLog.findMany({ where: { entityId: projectA.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['PROJECT_ARCHIVED', 'PROJECT_RESTORED']));
  });

  it('delete removes a project with no operations and logs it (ADR-042)', async () => {
    const { s, projectA } = await setup();
    const res = await deleteRoute(
      mkReq(`/api/projects/${projectA.id}`, { method: 'DELETE', cookie: await ctx(s.portalId, s.managerId, 'MANAGER') }),
      P(projectA.id),
    );
    expect(res.status).toBe(200);
    expect(await testDb.project.findUnique({ where: { id: projectA.id } })).toBeNull();
    const audit = await testDb.auditLog.findFirst({ where: { entityId: projectA.id, action: 'PROJECT_DELETED' } });
    expect(audit?.before).toMatchObject({ name: projectA.name });
  });

  it('delete refuses a project with live operations, and an employee cannot delete', async () => {
    const { s, projectA } = await setup();
    await testDb.financialEntry.create({
      data: {
        portalId: s.portalId,
        projectId: projectA.id,
        categoryId: s.expenseCategoryId,
        direction: 'EXPENSE',
        budgetType: 'FACT',
        calculationMode: 'FIXED',
        operationDate: new Date('2026-01-01'),
        amount: '1000',
        createdById: s.managerId,
        updatedById: s.managerId,
      },
    });
    const refused = await deleteRoute(
      mkReq(`/api/projects/${projectA.id}`, { method: 'DELETE', cookie: await ctx(s.portalId, s.adminId, 'ADMIN') }),
      P(projectA.id),
    );
    expect(refused.status).toBe(409);
    const employee = await deleteRoute(
      mkReq(`/api/projects/${projectA.id}`, { method: 'DELETE', cookie: await ctx(s.portalId, s.employeeId, 'EMPLOYEE') }),
      P(projectA.id),
    );
    expect(employee.status).toBe(403);
    expect(await testDb.project.findUnique({ where: { id: projectA.id } })).not.toBeNull();
  });

  it('members PUT diffs membership and logs each change', async () => {
    const { s, projectA } = await setup();
    // A currently has the employee; swap to admin+manager
    await membersRoute(mkReq(`/api/projects/${projectA.id}/members`, { method: 'PUT', cookie: await ctx(s.portalId, s.managerId, 'MANAGER'), body: { userIds: [s.adminId, s.managerId] } }), P(projectA.id));
    const members = await testDb.projectMember.findMany({ where: { projectId: projectA.id } });
    expect(members.map((m) => m.userId).sort()).toEqual([s.adminId, s.managerId].sort());
    const actions = (await testDb.auditLog.findMany({ where: { projectId: projectA.id } })).map((a) => a.action);
    expect(actions.filter((a) => a === 'PROJECT_MEMBER_ADDED')).toHaveLength(2);
    expect(actions.filter((a) => a === 'PROJECT_MEMBER_REMOVED')).toHaveLength(1);
  });

});
