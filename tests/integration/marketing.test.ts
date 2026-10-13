import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import type { CrmElement } from '@/domain/finance/marketing';

process.env.SESSION_SECRET = 'marketing-test-secret-at-least-32-bytes-long';

// Bitrix24 is mocked at the CRM read boundary: leads and deals are what the test says.
const crm: { leads: CrmElement[]; deals: CrmElement[] } = { leads: [], deals: [] };
vi.mock('@/server/services/portal-setup', async (orig) => ({
  ...(await orig<typeof import('@/server/services/portal-setup')>()),
  listCrmSections: async () => [
    { entityTypeId: 1, title: 'Лиды', role: 'TRAFFIC', isDefault: true },
    { entityTypeId: 2, title: 'Сделки', role: 'SALES', isDefault: true },
  ],
}));
vi.mock('@/lib/bitrix/marketing', async (orig) => ({
  ...(await orig<typeof import('@/lib/bitrix/marketing')>()),
  fetchSources: async () => ({ UC_Y: 'Яндекс Директ', WEB: 'Сайт' }),
  fetchStages: async () => ({
    NEW: { id: 'NEW', name: 'Новый', semantic: 'process', sort: 10, funnel: 'STATUS' },
    IN_PROCESS: {
      id: 'IN_PROCESS',
      name: 'В работе',
      semantic: 'process',
      sort: 20,
      funnel: 'STATUS',
    },
  }),
  fetchElements: async (_p: unknown, entityTypeId: number, filter: Record<string, string>) => {
    if (entityTypeId === 1) return { items: crm.leads, stages: {}, truncated: false };
    const items = '>=closedate' in filter ? crm.deals.filter((d) => d.closedAt) : crm.deals;
    return { items, stages: {}, truncated: false };
  },
}));

const { POST: postSpend } = await import('@/app/api/marketing/spend/route');
const { DELETE: deleteSpend } = await import('@/app/api/marketing/spend/[id]/route');
const { PUT: putPlan } = await import('@/app/api/marketing/plan/route');
const { GET: exportGet } = await import('@/app/api/marketing/export/route');

async function cookie(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') {
  const t = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}
const req = (url: string, c: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: new Headers({ cookie: c, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

let n = 0;
const el = (p: Partial<CrmElement>): CrmElement => ({
  entityTypeId: 1,
  id: String(++n),
  sourceId: 'UC_Y',
  assignedById: '2',
  stageId: 'NEW',
  semantic: 'process',
  opportunity: '0',
  createdAt: new Date('2026-09-10T10:00:00Z'),
  closedAt: null,
  ...p,
});

describe('Marketing by channel (ADR-048)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
    crm.leads = [];
    crm.deals = [];
  });
  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function setup() {
    const s = await seedPortal();
    await testDb.portalInstallation.update({ where: { id: s.portalId }, data: { plan: 'PRO' } });
    return s;
  }

  it('spend is audited and soft-deleted; employees cannot add it', async () => {
    const s = await setup();
    const c = await cookie(s.portalId, s.managerId, 'MANAGER');
    const body = {
      sourceId: 'UC_Y',
      channel: 'Яндекс Директ',
      date: '2026-09-05',
      kind: 'SPENT',
      amount: '12 500,50',
    };
    const res = await postSpend(req('/api/marketing/spend', c, 'POST', body));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    const row = await testDb.marketingSpend.findUniqueOrThrow({ where: { id } });
    expect(row.amount.toString()).toBe('12500.5');
    expect(row.date.toISOString().slice(0, 10)).toBe('2026-09-05');

    const emp = await cookie(s.portalId, s.employeeId, 'EMPLOYEE');
    expect((await postSpend(req('/api/marketing/spend', emp, 'POST', body))).status).toBe(403);
    expect(
      (await postSpend(req('/api/marketing/spend', c, 'POST', { ...body, amount: '0' }))).status,
    ).toBe(400);

    const del = await deleteSpend(req(`/api/marketing/spend/${id}`, c, 'DELETE'), {
      params: Promise.resolve({ id }),
    });
    expect(del.status).toBe(200);
    expect(
      (await testDb.marketingSpend.findUniqueOrThrow({ where: { id } })).deletedAt,
    ).not.toBeNull();
    const audit = await testDb.auditLog.findMany({
      where: { entityType: 'MARKETING_SPEND' },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual(['FINANCE_CREATED', 'FINANCE_DELETED']);
  });

  it('a spend from another portal cannot be deleted', async () => {
    const s = await setup();
    const other = await seedPortal();
    const foreign = await testDb.marketingSpend.create({
      data: {
        portalId: other.portalId,
        sourceId: 'WEB',
        date: new Date('2026-09-01'),
        amount: '100',
      },
    });
    const c = await cookie(s.portalId, s.managerId, 'MANAGER');
    const del = await deleteSpend(req(`/api/marketing/spend/${foreign.id}`, c, 'DELETE'), {
      params: Promise.resolve({ id: foreign.id }),
    });
    expect(del.status).toBe(404);
  });

  it('exports channels with CPL and CAC from spent budget, and plan against fact', async () => {
    const s = await setup();
    const c = await cookie(s.portalId, s.managerId, 'MANAGER');
    await postSpend(
      req('/api/marketing/spend', c, 'POST', {
        sourceId: 'UC_Y',
        date: '2026-09-05',
        kind: 'SPENT',
        amount: '40000',
      }),
    );
    await postSpend(
      req('/api/marketing/spend', c, 'POST', {
        sourceId: 'UC_Y',
        date: '2026-09-01',
        kind: 'PAID',
        amount: '100000',
      }),
    );
    const plan = await putPlan(
      req('/api/marketing/plan', c, 'PUT', {
        month: '2026-09',
        budget: '50000',
        leads: 10,
        qualifiedLeads: 4,
        sales: 2,
      }),
    );
    expect(plan.status).toBe(200);

    crm.leads = [
      el({}),
      el({ stageId: 'IN_PROCESS' }),
      el({ stageId: 'CONVERTED', semantic: 'success' }),
      el({ stageId: 'JUNK', semantic: 'fail' }),
      el({ sourceId: 'WEB', stageId: 'IN_PROCESS' }),
    ];
    crm.deals = [
      el({
        entityTypeId: 2,
        stageId: 'WON',
        semantic: 'success',
        opportunity: '150000',
        closedAt: new Date('2026-09-20T00:00:00Z'),
      }),
      el({ entityTypeId: 2, stageId: 'NEW' }),
    ];

    const res = await exportGet(req('/api/marketing/export?m=2026-09&format=csv', c));
    expect(res.status).toBe(200);
    const lines = (await res.text()).replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe(
      'Канал;Расход, ₽;Оплачено, ₽;Лиды;CPL, ₽;Квал. лиды;CPL-2, ₽;Лид → квал, %;Продажи;CAC, ₽;Выручка, ₽;ROMI, %',
    );
    expect(lines[1]).toBe('Яндекс Директ;40000;100000;4;10000;2;20000;50;1;40000;150000;275');
    expect(lines[2]).toBe('Сайт;0;0;1;;1;;100;0;;0;');
    expect(lines[3]).toBe('Итого;40000;100000;5;8000;3;13333,33;60;1;40000;150000;275');

    const xlsx = await exportGet(req('/api/marketing/export?m=2026-09&format=xlsx', c));
    expect(xlsx.headers.get('content-type')).toContain('spreadsheetml');

    const sales = await exportGet(req('/api/marketing/export?m=2026-09&tab=sales&format=csv', c));
    const sl = (await sales.text()).replace('﻿', '').trim().split('\r\n');
    expect(sl[1]).toBe('Яндекс Директ;2;1;1;0;50;1;150000;150000');
  });

  it('free plan gets no marketing', async () => {
    const s = await seedPortal();
    const c = await cookie(s.portalId, s.managerId, 'MANAGER');
    expect((await exportGet(req('/api/marketing/export', c))).status).toBe(403);
  });
});
