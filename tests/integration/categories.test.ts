import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { GET as listRoute, POST as createRoute } from '@/app/api/categories/route';
import { PATCH as patchRoute, DELETE as deleteRoute } from '@/app/api/categories/[id]/route';

process.env.SESSION_SECRET = 'categories-test-secret-at-least-32-bytes-xx';

async function ck(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') {
  const t = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}
function req(url: string, o: { method?: string; cookie: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: o.method ?? 'GET',
    headers: new Headers({ cookie: o.cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
}
const P = (id: string) => ({ params: Promise.resolve({ id }) });

describe('categories API (ТЗ §28)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('employee cannot create -> 403', async () => {
    const s = await seedPortal();
    const res = await createRoute(
      req('/api/categories', {
        method: 'POST',
        cookie: await ck(s.portalId, s.employeeId, 'EMPLOYEE'),
        body: { kind: 'EXPENSE', name: 'Реклама' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('manager creates a category, it appears grouped', async () => {
    const s = await seedPortal();
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');
    await createRoute(req('/api/categories', { method: 'POST', cookie, body: { kind: 'EXPENSE', name: 'Реклама', accentColor: 'orange' } }));
    const body = await (await listRoute(req('/api/categories', { cookie }))).json();
    expect(body.categories.map((c: { name: string }) => c.name)).toContain('Реклама');
  });

  it('rejects an invalid accent color -> 400', async () => {
    const s = await seedPortal();
    const res = await createRoute(
      req('/api/categories', {
        method: 'POST',
        cookie: await ck(s.portalId, s.managerId, 'MANAGER'),
        body: { kind: 'EXPENSE', name: 'X', accentColor: 'neon-pink' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('deletes an unused category but blocks deleting a used one (ТЗ §28)', async () => {
    const s = await seedPortal();
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');
    const created = await (await createRoute(req('/api/categories', { method: 'POST', cookie, body: { kind: 'EXPENSE', name: 'Временная' } }))).json();

    // unused -> deletable
    expect((await deleteRoute(req(`/api/categories/${created.id}`, { method: 'DELETE', cookie }), P(created.id))).status).toBe(200);

    // used -> only archivable
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    await testDb.financialEntry.create({
      data: {
        portalId: s.portalId,
        projectId: project.id,
        categoryId: s.expenseCategoryId,
        direction: 'EXPENSE',
        budgetType: 'FACT',
        operationDate: new Date('2026-01-01'),
        amount: '1000',
      },
    });
    const res = await deleteRoute(req(`/api/categories/${s.expenseCategoryId}`, { method: 'DELETE', cookie }), P(s.expenseCategoryId));
    expect(res.status).toBe(400);
  });

  it('archiving hides from the active list but history still resolves the name', async () => {
    const s = await seedPortal();
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');
    await patchRoute(req(`/api/categories/${s.expenseCategoryId}`, { method: 'PATCH', cookie, body: { isArchived: true } }), P(s.expenseCategoryId));

    const active = await (await listRoute(req('/api/categories', { cookie }))).json();
    expect(active.categories.map((c: { id: string }) => c.id)).not.toContain(s.expenseCategoryId);

    const all = await (await listRoute(req('/api/categories?includeArchived=true', { cookie }))).json();
    expect(all.categories.map((c: { id: string }) => c.id)).toContain(s.expenseCategoryId);

    const audit = await testDb.auditLog.findFirst({ where: { entityId: s.expenseCategoryId, action: 'CATEGORY_ARCHIVED' } });
    expect(audit).not.toBeNull();
  });
});
