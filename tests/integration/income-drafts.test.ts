import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { GET as listDraftsRoute } from '@/app/api/income-drafts/route';
import { POST as approveRoute } from '@/app/api/income-drafts/[id]/approve/route';
import { POST as rejectRoute } from '@/app/api/income-drafts/[id]/reject/route';

process.env.SESSION_SECRET = 'income-drafts-test-secret-at-least-32-bytes';
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

async function makeDraft(portalId: string, projectId: string, crmAmount = '450000.00') {
  return testDb.crmIncomeDraft.create({ data: { portalId, projectId, crmAmount, status: 'PENDING' } });
}

describe('CRM income-draft review (ADR-028)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('EMPLOYEE cannot list or resolve income drafts', async () => {
    const s = await seedPortal();
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    const draft = await makeDraft(s.portalId, project.id);
    const cookie = await ck(s.portalId, s.employeeId, 'EMPLOYEE');

    expect((await listDraftsRoute(req('/api/income-drafts', { cookie }))).status).toBe(403);
    expect(
      (await approveRoute(req(`/api/income-drafts/${draft.id}/approve`, { method: 'POST', cookie, body: { categoryId: 'x' } }), P(draft.id)))
        .status,
    ).toBe(403);
    expect((await rejectRoute(req(`/api/income-drafts/${draft.id}/reject`, { method: 'POST', cookie }), P(draft.id))).status).toBe(403);
  });

  it('lists PENDING income drafts', async () => {
    const s = await seedPortal();
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'Проект X' } });
    await makeDraft(s.portalId, project.id, '450000.00');
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');

    const res = await listDraftsRoute(req('/api/income-drafts', { cookie }));
    const { drafts } = await res.json();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].crmAmount).toBe('450000');
    expect(drafts[0].projectName).toBe('Проект X');
  });

  it('approving creates a PLAN income entry and resolves the draft', async () => {
    const s = await seedPortal();
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    const draft = await makeDraft(s.portalId, project.id, '450000.00');
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');

    const res = await approveRoute(
      req(`/api/income-drafts/${draft.id}/approve`, { method: 'POST', cookie, body: { categoryId: s.incomeCategoryId } }),
      P(draft.id),
    );
    expect(res.status).toBe(200);
    const { entryId } = await res.json();

    const entry = await testDb.financialEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.direction).toBe('INCOME');
    expect(entry.budgetType).toBe('PLAN');
    expect(entry.amount.toString()).toBe('450000');

    const resolved = await testDb.crmIncomeDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(resolved.status).toBe('APPROVED');
    expect(resolved.resultingEntryId).toBe(entryId);
  });

  it('approving a second, higher amount for the same project updates the SAME entry, not a new one', async () => {
    const s = await seedPortal();
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    const cookie = await ck(s.portalId, s.adminId, 'ADMIN');

    const first = await makeDraft(s.portalId, project.id, '450000.00');
    const firstRes = await approveRoute(
      req(`/api/income-drafts/${first.id}/approve`, { method: 'POST', cookie, body: { categoryId: s.incomeCategoryId } }),
      P(first.id),
    );
    const { entryId: firstEntryId } = await firstRes.json();

    // Simulate the nightly sync re-opening the SAME draft row at a new amount (unique on
    // portalId+projectId, so this mirrors what syncPortalIncome would do).
    const reopened = await testDb.crmIncomeDraft.update({
      where: { id: first.id },
      data: { crmAmount: '500000.00', status: 'PENDING' },
    });

    const secondRes = await approveRoute(
      req(`/api/income-drafts/${reopened.id}/approve`, { method: 'POST', cookie, body: { categoryId: s.incomeCategoryId } }),
      P(reopened.id),
    );
    const { entryId: secondEntryId } = await secondRes.json();

    expect(secondEntryId).toBe(firstEntryId);
    expect(await testDb.financialEntry.count({ where: { projectId: project.id } })).toBe(1);
    const entry = await testDb.financialEntry.findUniqueOrThrow({ where: { id: firstEntryId } });
    expect(entry.amount.toString()).toBe('500000');
  });

  it('rejecting an income draft creates no FinancialEntry', async () => {
    const s = await seedPortal();
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'P' } });
    const draft = await makeDraft(s.portalId, project.id);
    const cookie = await ck(s.portalId, s.managerId, 'MANAGER');

    const res = await rejectRoute(req(`/api/income-drafts/${draft.id}/reject`, { method: 'POST', cookie }), P(draft.id));
    expect(res.status).toBe(200);

    const resolved = await testDb.crmIncomeDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(resolved.status).toBe('REJECTED');
    expect(await testDb.financialEntry.count({ where: { portalId: s.portalId } })).toBe(0);
  });
});
