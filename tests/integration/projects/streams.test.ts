import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { GET as listRoute, POST as createRoute } from '@/app/api/projects/[id]/streams/route';
import { DELETE as deleteRoute } from '@/app/api/projects/[id]/streams/[streamId]/route';
import { POST as financeCreate } from '@/app/api/finance/route';

process.env.SESSION_SECRET = 'streams-api-test-secret-at-least-32-bytes-x';

type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
async function ck(portalId: string, userId: string, role: Role) {
  const token = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=t`;
}
function req(url: string, o: { method?: string; cookie: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: o.method ?? 'GET',
    headers: new Headers({
      cookie: o.cookie,
      'content-type': 'application/json',
      [CSRF_HEADER]: 't',
    }),
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
}
const P = <T>(p: T) => ({ params: Promise.resolve(p) });

describe('project directions (ADR-052)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function setup() {
    const s = await seedPortal();
    const [a, b] = await Promise.all(
      ['Проект А', 'Проект Б'].map((name) =>
        testDb.project.create({
          data: {
            portalId: s.portalId,
            name,
            members: { create: { portalId: s.portalId, userId: s.employeeId } },
          },
        }),
      ),
    );
    return { s, a: a!, b: b! };
  }

  it('creates directions and splits economics by tagged operations', async () => {
    const { s, a } = await setup();
    const manager = await ck(s.portalId, s.managerId, 'MANAGER');
    const mk = async (body: unknown) => {
      const res = await createRoute(
        req(`/api/projects/${a.id}/streams`, { method: 'POST', cookie: manager, body }),
        P({ id: a.id }),
      );
      expect(res.status).toBe(201);
      return (await res.json()) as { id: string };
    };
    const support = await mk({
      kind: 'SUPPORT',
      monthlyFee: '50000',
      hourRate: '3000',
      hoursLimit: '20',
      memberIds: [s.employeeId],
    });
    await mk({ kind: 'DEVELOPMENT', budget: '900000', memberIds: [] });

    const entry = (body: Record<string, unknown>) =>
      financeCreate(
        req('/api/finance', {
          method: 'POST',
          cookie: manager,
          body: { projectId: a.id, budgetType: 'FACT', operationDate: '2026-03-01', ...body },
        }),
      );
    expect(
      (
        await entry({
          categoryId: s.incomeCategoryId,
          direction: 'INCOME',
          amount: '50000',
          streamId: support.id,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await entry({
          categoryId: s.expenseCategoryId,
          direction: 'EXPENSE',
          amount: '20000',
          streamId: support.id,
        })
      ).status,
    ).toBe(201);
    expect(
      (await entry({ categoryId: s.incomeCategoryId, direction: 'INCOME', amount: '7000' })).status,
    ).toBe(201);

    const res = await listRoute(
      req(`/api/projects/${a.id}/streams`, { cookie: manager }),
      P({ id: a.id }),
    );
    const body = (await res.json()) as {
      streams: Array<{
        id: string;
        kind: string;
        economics: { factIncome: string; factExpense: string };
      }>;
      untagged: { factIncome: string } | null;
    };
    expect(body.streams.map((x) => x.kind).sort()).toEqual(['DEVELOPMENT', 'SUPPORT']);
    const sup = body.streams.find((x) => x.id === support.id)!;
    expect(Number(sup.economics.factIncome)).toBe(50000);
    expect(Number(sup.economics.factExpense)).toBe(20000);
    expect(Number(body.streams.find((x) => x.kind === 'DEVELOPMENT')!.economics.factIncome)).toBe(
      0,
    );
    expect(Number(body.untagged?.factIncome)).toBe(7000);
  });

  it('rejects an operation tagged with another project’s direction', async () => {
    const { s, a, b } = await setup();
    const manager = await ck(s.portalId, s.managerId, 'MANAGER');
    const res = await createRoute(
      req(`/api/projects/${b.id}/streams`, {
        method: 'POST',
        cookie: manager,
        body: { kind: 'SUPPORT', memberIds: [] },
      }),
      P({ id: b.id }),
    );
    const other = (await res.json()) as { id: string };
    const bad = await financeCreate(
      req('/api/finance', {
        method: 'POST',
        cookie: manager,
        body: {
          projectId: a.id,
          categoryId: s.incomeCategoryId,
          direction: 'INCOME',
          budgetType: 'FACT',
          operationDate: '2026-03-01',
          amount: '1000',
          streamId: other.id,
        },
      }),
    );
    expect(bad.status).toBe(400);
  });

  it('employees cannot create directions; archived ones leave the list', async () => {
    const { s, a } = await setup();
    const employee = await ck(s.portalId, s.employeeId, 'EMPLOYEE');
    const denied = await createRoute(
      req(`/api/projects/${a.id}/streams`, {
        method: 'POST',
        cookie: employee,
        body: { kind: 'SUPPORT', memberIds: [] },
      }),
      P({ id: a.id }),
    );
    expect(denied.status).toBe(403);

    const manager = await ck(s.portalId, s.managerId, 'MANAGER');
    const created = (await (
      await createRoute(
        req(`/api/projects/${a.id}/streams`, {
          method: 'POST',
          cookie: manager,
          body: { kind: 'CONSULTING', memberIds: [] },
        }),
        P({ id: a.id }),
      )
    ).json()) as { id: string };
    const del = await deleteRoute(
      req(`/api/projects/${a.id}/streams/${created.id}`, { method: 'DELETE', cookie: manager }),
      P({ id: a.id, streamId: created.id }),
    );
    expect(del.status).toBe(200);
    const list = (await (
      await listRoute(req(`/api/projects/${a.id}/streams`, { cookie: manager }), P({ id: a.id }))
    ).json()) as {
      streams: unknown[];
    };
    expect(list.streams).toHaveLength(0);
  });
});
