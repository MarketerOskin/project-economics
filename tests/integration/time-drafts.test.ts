import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { GET as listDraftsRoute } from '@/app/api/time-drafts/route';
import { POST as approveRoute } from '@/app/api/time-drafts/[id]/approve/route';
import { POST as rejectRoute } from '@/app/api/time-drafts/[id]/reject/route';
import { PATCH as patchUserRoute } from '@/app/api/users/[id]/route';

process.env.SESSION_SECRET = 'time-drafts-test-secret-at-least-32-bytes-x';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

async function ck(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') {
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

async function makeDraft(portalId: string, projectId: string, employeeId: string, hours = '2.00') {
  return testDb.taskTimeDraft.create({
    data: { portalId, projectId, employeeId, workDate: new Date('2026-09-10'), hours, bitrixTaskIds: [5], status: 'PENDING' },
  });
}

describe('Time-draft review (ADR-027)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('EMPLOYEE cannot list or resolve drafts', async () => {
    const s = await seedPortal();
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    const draft = await makeDraft(s.portalId, project.id, s.managerId);
    const cookie = await ck(s.portalId, s.employeeId, 'EMPLOYEE');

    expect((await listDraftsRoute(req('/api/time-drafts', { cookie }))).status).toBe(403);
    expect(
      (await approveRoute(req(`/api/time-drafts/${draft.id}/approve`, { method: 'POST', cookie, body: { categoryId: 'x' } }), P(draft.id))).status,
    ).toBe(403);
    expect((await rejectRoute(req(`/api/time-drafts/${draft.id}/reject`, { method: 'POST', cookie }), P(draft.id))).status).toBe(403);
  });

  it('lists PENDING drafts with the amount computed from the employee rate', async () => {
    const s = await seedPortal();
    await testDb.appUser.update({ where: { id: s.managerId }, data: { hourlyRate: '1500.00' } });
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    await makeDraft(s.portalId, project.id, s.managerId, '2.00');
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');

    const res = await listDraftsRoute(req('/api/time-drafts', { cookie }));
    const { drafts } = await res.json();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].hours).toBe('2');
    expect(drafts[0].amount).toBe('3000');
  });

  it('blocks approval when the employee has no hourly rate set', async () => {
    const s = await seedPortal();
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    const draft = await makeDraft(s.portalId, project.id, s.managerId);
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');

    const res = await approveRoute(
      req(`/api/time-drafts/${draft.id}/approve`, { method: 'POST', cookie, body: { categoryId: s.expenseCategoryId } }),
      P(draft.id),
    );
    expect(res.status).toBe(400);
  });

  it('approving creates a real FinancialEntry and resolves the draft', async () => {
    const s = await seedPortal();
    await testDb.appUser.update({ where: { id: s.managerId }, data: { hourlyRate: '1000.00' } });
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    const draft = await makeDraft(s.portalId, project.id, s.managerId, '3.00');
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');

    const res = await approveRoute(
      req(`/api/time-drafts/${draft.id}/approve`, { method: 'POST', cookie, body: { categoryId: s.expenseCategoryId } }),
      P(draft.id),
    );
    expect(res.status).toBe(200);
    const { entryId } = await res.json();

    const entry = await testDb.financialEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.direction).toBe('EXPENSE');
    expect(entry.budgetType).toBe('FACT');
    expect(entry.calculationMode).toBe('HOURS_RATE');
    expect(entry.amount.toString()).toBe('3000');
    expect(entry.employeeId).toBe(s.managerId);

    const resolved = await testDb.taskTimeDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(resolved.status).toBe('APPROVED');
    expect(resolved.resultingEntryId).toBe(entryId);

    // Approving twice is rejected — already resolved.
    const second = await approveRoute(
      req(`/api/time-drafts/${draft.id}/approve`, { method: 'POST', cookie, body: { categoryId: s.expenseCategoryId } }),
      P(draft.id),
    );
    expect(second.status).toBe(400);
  });

  it('rejecting a draft creates no FinancialEntry', async () => {
    const s = await seedPortal();
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    const draft = await makeDraft(s.portalId, project.id, s.managerId);
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');

    const res = await rejectRoute(req(`/api/time-drafts/${draft.id}/reject`, { method: 'POST', cookie }), P(draft.id));
    expect(res.status).toBe(200);

    const resolved = await testDb.taskTimeDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(resolved.status).toBe('REJECTED');
    expect(await testDb.financialEntry.count({ where: { portalId: s.portalId } })).toBe(0);
  });
});

describe('PATCH /api/users/:id — hourly rate (ADR-027)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('admin sets an hourly rate', async () => {
    const s = await seedPortal();
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');
    const res = await patchUserRoute(
      req(`/api/users/${s.managerId}`, { method: 'PATCH', cookie, body: { hourlyRate: 1234.5 } }),
      P(s.managerId),
    );
    expect(res.status).toBe(200);
    const updated = await testDb.appUser.findUniqueOrThrow({ where: { id: s.managerId } });
    expect(updated.hourlyRate?.toString()).toBe('1234.5');
  });

  it('non-admin cannot set an hourly rate', async () => {
    const s = await seedPortal();
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');
    const res = await patchUserRoute(
      req(`/api/users/${s.employeeId}`, { method: 'PATCH', cookie, body: { hourlyRate: 500 } }),
      P(s.employeeId),
    );
    expect(res.status).toBe(403);
  });
});
