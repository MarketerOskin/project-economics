import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { GET as listRoute, POST as createRoute } from '@/app/api/finance/route';
import { PATCH as patchRoute, DELETE as deleteRoute } from '@/app/api/finance/[id]/route';
import { GET as projectGet } from '@/app/api/projects/[id]/route';

process.env.SESSION_SECRET = 'finance-api-test-secret-at-least-32-bytes-x';

type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
async function ck(portalId: string, userId: string, role: Role) {
  const token = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=t`;
}
function req(url: string, o: { method?: string; cookie: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: o.method ?? 'GET',
    headers: new Headers({ cookie: o.cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
}
const P = (id: string) => ({ params: Promise.resolve({ id }) });

describe('finance API', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function setup() {
    const s = await seedPortal();
    const project = await testDb.project.create({
      data: {
        portalId: s.portalId,
        name: 'Проект',
        members: { create: { portalId: s.portalId, userId: s.employeeId } },
      },
    });
    return { s, project };
  }

  it('employee POST -> 403', async () => {
    const { s, project } = await setup();
    const res = await createRoute(
      req('/api/finance', {
        method: 'POST',
        cookie: await ck(s.portalId, s.employeeId, 'EMPLOYEE'),
        body: { projectId: project.id, categoryId: s.expenseCategoryId, direction: 'EXPENSE', budgetType: 'FACT', operationDate: '2026-03-01', amount: '1000' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('HOURS_RATE amount is computed server-side and the client value is ignored (ТЗ §14)', async () => {
    const { s, project } = await setup();
    const res = await createRoute(
      req('/api/finance', {
        method: 'POST',
        cookie: await ck(s.portalId, s.managerId, 'MANAGER'),
        body: {
          projectId: project.id,
          categoryId: s.expenseCategoryId,
          direction: 'EXPENSE',
          budgetType: 'FACT',
          operationDate: '2026-03-01',
          calculationMode: 'HOURS_RATE',
          hours: '100',
          hourlyRate: '2000',
          amount: '1',
        },
      }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const entry = await testDb.financialEntry.findUnique({ where: { id } });
    expect(entry?.amount.toString()).toBe('200000');
    expect(entry?.hours?.toString()).toBe('100');
  });

  it('rejects a category whose kind does not match the direction -> 400', async () => {
    const { s, project } = await setup();
    const res = await createRoute(
      req('/api/finance', {
        method: 'POST',
        cookie: await ck(s.portalId, s.managerId, 'MANAGER'),
        body: { projectId: project.id, categoryId: s.incomeCategoryId, direction: 'EXPENSE', budgetType: 'FACT', operationDate: '2026-03-01', amount: '1000' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('writes a FINANCE_CREATED audit row', async () => {
    const { s, project } = await setup();
    const res = await createRoute(
      req('/api/finance', {
        method: 'POST',
        cookie: await ck(s.portalId, s.managerId, 'MANAGER'),
        body: { projectId: project.id, categoryId: s.expenseCategoryId, direction: 'EXPENSE', budgetType: 'FACT', operationDate: '2026-03-01', amount: '50000' },
      }),
    );
    const { id } = await res.json();
    const audit = await testDb.auditLog.findFirst({ where: { entityId: id, action: 'FINANCE_CREATED' } });
    expect(audit).not.toBeNull();
  });

  it('PATCH records the amount change and recomputes economics; DELETE removes it from aggregates', async () => {
    const { s, project } = await setup();
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');
    // fact income 1_000_000, fact expense 25_000
    await createRoute(req('/api/finance', { method: 'POST', cookie, body: { projectId: project.id, categoryId: s.incomeCategoryId, direction: 'INCOME', budgetType: 'FACT', operationDate: '2026-03-01', amount: '1000000' } }));
    const expRes = await createRoute(req('/api/finance', { method: 'POST', cookie, body: { projectId: project.id, categoryId: s.expenseCategoryId, direction: 'EXPENSE', budgetType: 'FACT', operationDate: '2026-03-01', amount: '25000' } }));
    const { id: expId } = await expRes.json();

    let detail = await (await projectGet(req(`/api/projects/${project.id}`, { cookie }), P(project.id))).json();
    expect(detail.economics.factProfit).toBe('975000');

    await patchRoute(req(`/api/finance/${expId}`, { method: 'PATCH', cookie, body: { amount: '32000' } }), P(expId));
    const audit = await testDb.auditLog.findFirst({ where: { entityId: expId, action: 'FINANCE_UPDATED' } });
    expect((audit?.before as { amount: string }).amount).toBe('25000');
    expect((audit?.after as { amount: string }).amount).toBe('32000');

    detail = await (await projectGet(req(`/api/projects/${project.id}`, { cookie }), P(project.id))).json();
    expect(detail.economics.factProfit).toBe('968000');

    await deleteRoute(req(`/api/finance/${expId}`, { method: 'DELETE', cookie }), P(expId));
    const deleted = await testDb.financialEntry.findUnique({ where: { id: expId } });
    expect(deleted?.deletedAt).not.toBeNull();

    detail = await (await projectGet(req(`/api/projects/${project.id}`, { cookie }), P(project.id))).json();
    expect(detail.economics.factProfit).toBe('1000000');
  });

  it('list: employee sees only member-project entries, backend-paginated', async () => {
    const { s, project } = await setup();
    const foreign = await testDb.project.create({ data: { portalId: s.portalId, name: 'Чужой' } });
    const mgr = await ck(s.portalId, s.managerId, 'MANAGER');
    for (let i = 0; i < 3; i++) {
      await createRoute(req('/api/finance', { method: 'POST', cookie: mgr, body: { projectId: project.id, categoryId: s.expenseCategoryId, direction: 'EXPENSE', budgetType: 'FACT', operationDate: '2026-03-0' + (i + 1), amount: '1000' } }));
    }
    await createRoute(req('/api/finance', { method: 'POST', cookie: mgr, body: { projectId: foreign.id, categoryId: s.expenseCategoryId, direction: 'EXPENSE', budgetType: 'FACT', operationDate: '2026-03-05', amount: '9999' } }));

    const empList = await (await listRoute(req('/api/finance?pageSize=2', { cookie: await ck(s.portalId, s.employeeId, 'EMPLOYEE') }))).json();
    expect(empList.total).toBe(3);
    expect(empList.rows).toHaveLength(2);
    expect(empList.rows.every((r: { projectId: string }) => r.projectId === project.id)).toBe(true);
  });

  it('PATCH cannot move an entry onto another portal’s project (portal isolation, ТЗ §54)', async () => {
    const { s, project } = await setup();
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');
    const created = await createRoute(
      req('/api/finance', {
        method: 'POST',
        cookie,
        body: { projectId: project.id, categoryId: s.expenseCategoryId, direction: 'EXPENSE', budgetType: 'FACT', operationDate: '2026-03-01', amount: '1000' },
      }),
    );
    const { id } = await created.json();

    // A second, unrelated portal with its own project.
    const other = await seedPortal();
    const otherProject = await testDb.project.create({ data: { portalId: other.portalId, name: 'Чужой портал' } });

    const res = await patchRoute(
      req(`/api/finance/${id}`, { method: 'PATCH', cookie, body: { projectId: otherProject.id } }),
      P(id),
    );
    expect(res.status).toBe(404);

    const entry = await testDb.financialEntry.findUnique({ where: { id } });
    expect(entry?.projectId).toBe(project.id);
  });

  it('list hides deleted entries by default, shows them for admin with includeDeleted', async () => {
    const { s, project } = await setup();
    const admin = await ck(s.portalId, s.adminId, 'ADMIN');
    const r = await createRoute(req('/api/finance', { method: 'POST', cookie: admin, body: { projectId: project.id, categoryId: s.expenseCategoryId, direction: 'EXPENSE', budgetType: 'FACT', operationDate: '2026-03-01', amount: '1000' } }));
    const { id } = await r.json();
    await deleteRoute(req(`/api/finance/${id}`, { method: 'DELETE', cookie: admin }), P(id));

    const hidden = await (await listRoute(req('/api/finance', { cookie: admin }))).json();
    expect(hidden.total).toBe(0);
    const shown = await (await listRoute(req('/api/finance?includeDeleted=true', { cookie: admin }))).json();
    expect(shown.total).toBe(1);
  });
});
