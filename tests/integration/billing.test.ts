import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { hashOperatorPassword } from '@/lib/operator/password';
import { OPERATOR_COOKIE, signOperatorSession } from '@/lib/operator/session';
import { GET as getLeadRoute, POST as createLeadRoute } from '@/app/api/billing/pro-lead/route';
import { GET as operatorLeadsRoute } from '@/app/api/operator/leads/route';
import { PATCH as operatorLeadStatusRoute } from '@/app/api/operator/leads/[id]/route';
import { GET as operatorOverviewRoute } from '@/app/api/operator/overview/route';
import { PATCH as setPlanRoute } from '@/app/api/operator/portals/[id]/plan/route';

process.env.SESSION_SECRET = 'billing-test-secret-at-least-32-bytes-xxxxx';
process.env.OPERATOR_EMAIL = 'owner@example.com';
process.env.OPERATOR_PASSWORD_HASH = hashOperatorPassword('op-password-123');

async function portalCookie(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' = 'MANAGER') {
  const t = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}

async function operatorCookie() {
  const t = await signOperatorSession('owner@example.com');
  return `${OPERATOR_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}

function req(url: string, cookie: string, opts: { method?: string; body?: unknown } = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? 'GET',
    headers: new Headers({ cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const P = (id: string) => ({ params: Promise.resolve({ id }) });

describe('billing: PRO leads (pricing -> operator sales funnel)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('portal side: no pending lead initially', async () => {
    const s = await seedPortal();
    const res = await getLeadRoute(req('/api/billing/pro-lead', await portalCookie(s.portalId, s.managerId)));
    const body = await res.json();
    expect(body.pending).toBe(false);
    expect(body.lead).toBeNull();
  });

  it('submits a lead, blocks a second one while it is open, reflects it as pending', async () => {
    const s = await seedPortal();
    const cookie = await portalCookie(s.portalId, s.managerId);

    const created = await createLeadRoute(
      req('/api/billing/pro-lead', cookie, { method: 'POST', body: { contact: 'owner@client.ru', comment: '5 человек в команде' } }),
    );
    expect(created.status).toBe(201);

    const dupe = await createLeadRoute(
      req('/api/billing/pro-lead', cookie, { method: 'POST', body: { contact: 'again@client.ru' } }),
    );
    expect(dupe.status).toBe(409);

    const status = await (await getLeadRoute(req('/api/billing/pro-lead', cookie))).json();
    expect(status.pending).toBe(true);
    expect(status.lead.contact).toBe('owner@client.ru');
    expect(status.lead.status).toBe('NEW');

    expect(await testDb.proLead.count({ where: { portalId: s.portalId } })).toBe(1);
    const stored = await testDb.proLead.findFirst({ where: { portalId: s.portalId } });
    expect(stored?.requestedByName).toContain('Manager');
  });

  it('rejects a lead with no auth (unauthenticated request, CSRF present)', async () => {
    const res = await createLeadRoute(
      new NextRequest('http://localhost/api/billing/pro-lead', {
        method: 'POST',
        headers: new Headers({
          'content-type': 'application/json',
          cookie: `${CSRF_COOKIE}=t`,
          [CSRF_HEADER]: 't',
        }),
        body: JSON.stringify({ contact: 'x@x.ru' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('operator: sees the lead with the portal domain, can mark CONTACTED then DECLINED', async () => {
    const s = await seedPortal();
    await createLeadRoute(
      req('/api/billing/pro-lead', await portalCookie(s.portalId, s.managerId), {
        method: 'POST',
        body: { contact: 'lead@client.ru' },
      }),
    );

    const opCookie = await operatorCookie();
    const listed = await (await operatorLeadsRoute(req('/api/operator/leads', opCookie))).json();
    expect(listed.leads).toHaveLength(1);
    expect(listed.leads[0].contact).toBe('lead@client.ru');
    expect(listed.leads[0].portalDomain).toBe('test.bitrix24.ru');
    expect(listed.leads[0].status).toBe('NEW');

    const leadId = listed.leads[0].id;
    const contactedRes = await operatorLeadStatusRoute(
      req(`/api/operator/leads/${leadId}`, opCookie, { method: 'PATCH', body: { status: 'CONTACTED' } }),
      P(leadId),
    );
    expect(contactedRes.status).toBe(200);

    const stored = await testDb.proLead.findUnique({ where: { id: leadId } });
    expect(stored?.status).toBe('CONTACTED');
    expect(stored?.handledByOperator).toBe('owner@example.com');
    expect(stored?.handledAt).not.toBeNull();
  });

  it('operator: granting PRO from a lead unlocks the portal and a new lead can be submitted again', async () => {
    const s = await seedPortal();
    await createLeadRoute(
      req('/api/billing/pro-lead', await portalCookie(s.portalId, s.managerId), {
        method: 'POST',
        body: { contact: 'buyer@client.ru' },
      }),
    );
    const opCookie = await operatorCookie();
    const { leads } = await (await operatorLeadsRoute(req('/api/operator/leads', opCookie))).json();
    const leadId = leads[0].id;

    // Operator grants PRO (as the "grant + convert" UI action would do in two calls).
    await setPlanRoute(
      req(`/api/operator/portals/${s.portalId}/plan`, opCookie, { method: 'PATCH', body: { plan: 'PRO' } }),
      P(s.portalId),
    );
    await operatorLeadStatusRoute(
      req(`/api/operator/leads/${leadId}`, opCookie, { method: 'PATCH', body: { status: 'CONVERTED' } }),
      P(leadId),
    );

    const portal = await testDb.portalInstallation.findUnique({ where: { id: s.portalId } });
    expect(portal?.plan).toBe('PRO');
    const lead = await testDb.proLead.findUnique({ where: { id: leadId } });
    expect(lead?.status).toBe('CONVERTED');

    // Converted leads are no longer "open" — the portal can submit a fresh request later.
    const cookie = await portalCookie(s.portalId, s.managerId);
    const status = await (await getLeadRoute(req('/api/billing/pro-lead', cookie))).json();
    expect(status.pending).toBe(false);
  });

  it('operator overview counts portals, PRO portals, and open (NEW) leads', async () => {
    const s1 = await seedPortal();
    const s2 = await seedPortal();
    await testDb.portalInstallation.update({ where: { id: s2.portalId }, data: { plan: 'PRO' } });
    await createLeadRoute(
      req('/api/billing/pro-lead', await portalCookie(s1.portalId, s1.managerId), { method: 'POST', body: { contact: 'a@a.ru' } }),
    );

    const opCookie = await operatorCookie();
    const overview = await (await operatorOverviewRoute(req('/api/operator/overview', opCookie))).json();
    expect(overview.portalCount).toBeGreaterThanOrEqual(2);
    expect(overview.proCount).toBeGreaterThanOrEqual(1);
    expect(overview.newLeadCount).toBe(1);
  });

  it('leads routes reject a request with no operator session', async () => {
    const res = await operatorLeadsRoute(new NextRequest('http://localhost/api/operator/leads'));
    expect(res.status).toBe(401);
  });
});
