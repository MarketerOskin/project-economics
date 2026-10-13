import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import type { AnalyticsProject, AnalyticsWorld } from '@/server/services/analytics';
import type { TimeEntry } from '@/domain/analytics/types';

process.env.SESSION_SECRET = 'support-billing-test-secret-at-least-32-bytes';

// Bitrix24 is mocked at the analytics boundary: the hours are what the test says they are.
const state: { project: AnalyticsProject | null } = { project: null };
vi.mock('@/server/services/analytics', async (orig) => ({
  ...(await orig<typeof import('@/server/services/analytics')>()),
  loadAnalytics: async (): Promise<AnalyticsWorld> => ({
    tz: 'Europe/Moscow',
    now: new Date('2026-10-13T09:00:00Z'),
    projects: state.project ? [state.project] : [],
    people: new Map(),
    fetchedAt: null,
    unlinked: [],
    staffIds: [],
  }),
}));

const { GET } = await import('@/app/api/support-billing/route');
const { POST } = await import('@/app/api/support-billing/post/route');

const H = 3600;

function project(id: string, entries: TimeEntry[], pricing: { hourRate?: string; monthlyFee?: string; limitHours?: number } = {}): AnalyticsProject {
  return {
    projectId: id,
    name: 'Поддержка «Север»',
    clientName: null,
    bitrixUrl: null,
    sourceKind: 'crm',
    limitHours: pricing.limitHours ?? null,
    monthlyFee: pricing.monthlyFee ?? null,
    hourRate: pricing.hourRate ?? null,
    tasks: [],
    entries,
    meetings: [],
    error: null,
    meetingsError: null,
    stale: false,
    fetchedAt: new Date(),
  };
}

const at = (iso: string) => new Date(iso);

async function cookie(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') {
  const t = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}
const req = (url: string, c: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: new Headers({ cookie: c, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

describe('Support hours → finance (ADR-045)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
    state.project = null;
  });
  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function setup() {
    const s = await seedPortal();
    await testDb.portalInstallation.update({ where: { id: s.portalId }, data: { plan: 'PRO' } });
    await testDb.appUser.update({ where: { id: s.managerId }, data: { hourlyRate: '1500.00' } });
    const p = await testDb.project.create({ data: { portalId: s.portalId, name: 'Поддержка «Север»', supportHourRate: '3000' } });
    return { s, p };
  }

  it('lists last and current month: hourly income, expense by rates, people without a rate', async () => {
    const { s, p } = await setup();
    // Manager (Bitrix 2) 2 h + admin (Bitrix 1, no rate) 1 h in September, 0.5 h in October.
    state.project = project(p.id, [
      { taskId: 1, userId: '2', seconds: 2 * H, at: at('2026-09-10T10:00:00Z'), comment: '' },
      { taskId: 1, userId: '1', seconds: 1 * H, at: at('2026-09-11T10:00:00Z'), comment: '' },
      { taskId: 2, userId: '2', seconds: 0.5 * H, at: at('2026-10-02T10:00:00Z'), comment: '' },
    ], { hourRate: '3000' });

    const res = await GET(req('/api/support-billing', await cookie(s.portalId, s.managerId, 'MANAGER')));
    expect(res.status).toBe(200);
    const { months } = await res.json();
    expect(months.map((m: { month: string }) => m.month)).toEqual(['2026-09', '2026-10']);
    const sep = months[0];
    expect(sep).toMatchObject({ income: '9000.00', expense: '3000.00', profit: '6000.00', current: false, posted: null });
    expect(sep.missingRates).toEqual(['Admin Тестовый']);
    expect(months[1]).toMatchObject({ income: '1500.00', expense: '750.00', current: true });
  });

  it('posting writes FACT income and per-specialist expense; posting again replaces them', async () => {
    const { s, p } = await setup();
    state.project = project(p.id, [{ taskId: 1, userId: '2', seconds: 2 * H, at: at('2026-09-10T10:00:00Z'), comment: '' }], { hourRate: '3000' });
    const c = await cookie(s.portalId, s.managerId, 'MANAGER');
    const body = { projectId: p.id, month: '2026-09', incomeCategoryId: s.incomeCategoryId, expenseCategoryId: s.expenseCategoryId };

    const first = await POST(req('/api/support-billing/post', c, body));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ income: '6000.00', expense: '3000.00', entries: 2 });

    const live = () => testDb.financialEntry.findMany({ where: { projectId: p.id, deletedAt: null }, orderBy: { direction: 'asc' } });
    let entries = await live();
    expect(entries.map((e) => [e.direction, e.budgetType, e.amount.toString(), e.operationDate.toISOString().slice(0, 10)])).toEqual([
      ['INCOME', 'FACT', '6000', '2026-09-30'],
      ['EXPENSE', 'FACT', '3000', '2026-09-30'],
    ]);
    expect(entries[1]).toMatchObject({ calculationMode: 'HOURS_RATE', employeeId: s.managerId });
    expect(entries[1]!.hours!.toString()).toBe('2');

    // Bitrix24 hours grew: the list flags it, re-posting swaps the entries.
    state.project = project(p.id, [{ taskId: 1, userId: '2', seconds: 3 * H, at: at('2026-09-10T10:00:00Z'), comment: '' }], { hourRate: '3000' });
    const { months } = await (await GET(req('/api/support-billing', c))).json();
    expect(months[0]).toMatchObject({ changed: true, posted: { income: '6000.00' } });

    expect((await POST(req('/api/support-billing/post', c, body))).status).toBe(200);
    entries = await live();
    expect(entries.map((e) => e.amount.toString())).toEqual(['9000', '4500']);
    expect(await testDb.financialEntry.count({ where: { projectId: p.id, deletedAt: { not: null } } })).toBe(2);
    expect(await testDb.auditLog.count({ where: { projectId: p.id, action: 'FINANCE_DELETED' } })).toBe(2);
    expect(await testDb.auditLog.count({ where: { projectId: p.id, action: 'FINANCE_CREATED' } })).toBe(4);
  });

  it('a package: the fee plus hours over it', async () => {
    const { s, p } = await setup();
    state.project = project(p.id, [{ taskId: 1, userId: '2', seconds: 5 * H, at: at('2026-09-10T10:00:00Z'), comment: '' }], {
      monthlyFee: '20000',
      hourRate: '3000',
      limitHours: 4,
    });
    const { months } = await (await GET(req('/api/support-billing', await cookie(s.portalId, s.managerId, 'MANAGER')))).json();
    expect(months[0]).toMatchObject({ income: '23000.00', expense: '7500.00' });
  });

  it('employees cannot see or post; only last and current month can be posted', async () => {
    const { s, p } = await setup();
    state.project = project(p.id, [], { hourRate: '3000' });
    const emp = await cookie(s.portalId, s.employeeId, 'EMPLOYEE');
    expect((await GET(req('/api/support-billing', emp))).status).toBe(403);
    const body = { projectId: p.id, month: '2026-09', incomeCategoryId: s.incomeCategoryId, expenseCategoryId: s.expenseCategoryId };
    expect((await POST(req('/api/support-billing/post', emp, body))).status).toBe(403);

    const mgr = await cookie(s.portalId, s.managerId, 'MANAGER');
    expect((await POST(req('/api/support-billing/post', mgr, { ...body, month: '2026-05' }))).status).toBe(400);
  });
});
