import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { PATCH } from '@/app/api/projects/[id]/support-package/route';

process.env.SESSION_SECRET = 'support-package-test-secret-at-least-32-bytes';

type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

async function ctx(portalId: string, userId: string, role: Role) {
  const token = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=t`;
}

function patch(id: string, body: unknown, cookie: string) {
  const req = new NextRequest(`http://localhost/api/projects/${id}/support-package`, {
    method: 'PATCH',
    headers: new Headers({ cookie, 'content-type': 'application/json', [CSRF_HEADER]: 't' }),
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
}

describe('PATCH /api/projects/:id/support-package (ADR-034)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function setup(plan: 'FREE' | 'PRO' = 'PRO') {
    const s = await seedPortal();
    if (plan === 'PRO') await testDb.portalInstallation.update({ where: { id: s.portalId }, data: { plan: 'PRO' } });
    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'Поддержка' } });
    return { s, project };
  }

  it('manager on Pro saves the package and it lands in the audit log', async () => {
    const { s, project } = await setup();
    const res = await patch(project.id, { hoursLimit: '8,5', monthlyFee: 15000, hourRate: '2500' }, await ctx(s.portalId, s.managerId, 'MANAGER'));
    expect(res.status).toBe(200);

    const saved = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(saved.supportHoursLimit?.toString()).toBe('8.5');
    expect(saved.supportMonthlyFee?.toString()).toBe('15000');
    expect(saved.supportHourRate?.toString()).toBe('2500');

    const audit = await testDb.auditLog.findFirst({ where: { portalId: s.portalId, entityId: project.id, action: 'PROJECT_UPDATED' } });
    expect(audit).not.toBeNull();
  });

  it('null clears a field', async () => {
    const { s, project } = await setup();
    const cookie = await ctx(s.portalId, s.adminId, 'ADMIN');
    await patch(project.id, { hoursLimit: 10, monthlyFee: 1000, hourRate: 100 }, cookie);
    const res = await patch(project.id, { hoursLimit: null, monthlyFee: null, hourRate: null }, cookie);
    expect(res.status).toBe(200);
    const saved = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(saved.supportHoursLimit).toBeNull();
    expect(saved.supportMonthlyFee).toBeNull();
    expect(saved.supportHourRate).toBeNull();
  });

  it('employee -> 403, nothing saved', async () => {
    const { s, project } = await setup();
    const res = await patch(project.id, { hoursLimit: 8, monthlyFee: null, hourRate: null }, await ctx(s.portalId, s.employeeId, 'EMPLOYEE'));
    expect(res.status).toBe(403);
    const saved = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(saved.supportHoursLimit).toBeNull();
  });

  it('Free plan -> 403 naming Pro', async () => {
    const { s, project } = await setup('FREE');
    const res = await patch(project.id, { hoursLimit: 8, monthlyFee: null, hourRate: null }, await ctx(s.portalId, s.managerId, 'MANAGER'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toContain('Pro');
  });

  it('rejects negative and over-precise values', async () => {
    const { s, project } = await setup();
    const cookie = await ctx(s.portalId, s.managerId, 'MANAGER');
    expect((await patch(project.id, { hoursLimit: -1, monthlyFee: null, hourRate: null }, cookie)).status).toBe(400);
    expect((await patch(project.id, { hoursLimit: null, monthlyFee: '10.123', hourRate: null }, cookie)).status).toBe(400);
  });

  it("another portal's project -> 404", async () => {
    const { project } = await setup();
    const other = await seedPortal();
    await testDb.portalInstallation.update({ where: { id: other.portalId }, data: { plan: 'PRO' } });
    const res = await patch(project.id, { hoursLimit: 8, monthlyFee: null, hourRate: null }, await ctx(other.portalId, other.managerId, 'MANAGER'));
    expect(res.status).toBe(404);
  });
});
