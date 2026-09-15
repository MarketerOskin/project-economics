import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { withPortal } from '@/lib/db/with-portal';
import { getOnboardingProgress } from '@/lib/onboarding';
import { signSession, SESSION_COOKIE } from '@/lib/auth/session';
import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/csrf';
import { POST as dismissRoute } from '@/app/api/onboarding/dismiss/route';

process.env.SESSION_SECRET = 'onboarding-test-secret-at-least-32-bytes-xx';

async function cookie(portalId: string, userId: string, role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') {
  const t = await signSession({ portalId, appUserId: userId, role, demo: false });
  return `${SESSION_COOKIE}=${t}; ${CSRF_COOKIE}=t`;
}

function req(c: string) {
  return new NextRequest('http://localhost/api/onboarding/dismiss', {
    method: 'POST',
    headers: new Headers({ cookie: c, [CSRF_HEADER]: 't' }),
  });
}

describe('onboarding checklist', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('a fresh portal has no steps done', async () => {
    const s = await seedPortal();
    const scope = withPortal(s.portalId, testDb);
    const progress = await getOnboardingProgress(scope);
    expect(progress.complete).toBe(false);
    expect(progress.steps.map((st) => st.done)).toEqual([false, false, false]);
  });

  it('marks each step done as the portal gets real data, completes once all three are true', async () => {
    const s = await seedPortal();
    const scope = withPortal(s.portalId, testDb);

    const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'Первый проект' } });
    let progress = await getOnboardingProgress(scope);
    expect(progress.steps.find((st) => st.key === 'project')?.done).toBe(true);
    expect(progress.steps.find((st) => st.key === 'team')?.done).toBe(false);
    expect(progress.complete).toBe(false);

    await testDb.projectMember.create({ data: { portalId: s.portalId, projectId: project.id, userId: s.managerId } });
    progress = await getOnboardingProgress(scope);
    expect(progress.steps.find((st) => st.key === 'team')?.done).toBe(true);
    expect(progress.complete).toBe(false);

    await testDb.financialEntry.create({
      data: {
        portalId: s.portalId,
        projectId: project.id,
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
    progress = await getOnboardingProgress(scope);
    expect(progress.steps.every((st) => st.done)).toBe(true);
    expect(progress.complete).toBe(true);
  });

  it('dismiss: EMPLOYEE -> 403, MANAGER -> 200 and persists onboardingDismissedAt', async () => {
    const s = await seedPortal();

    const forbidden = await dismissRoute(req(await cookie(s.portalId, s.employeeId, 'EMPLOYEE')));
    expect(forbidden.status).toBe(403);
    expect((await testDb.portalInstallation.findUnique({ where: { id: s.portalId } }))?.onboardingDismissedAt).toBeNull();

    const ok = await dismissRoute(req(await cookie(s.portalId, s.managerId, 'MANAGER')));
    expect(ok.status).toBe(200);
    const portal = await testDb.portalInstallation.findUnique({ where: { id: s.portalId } });
    expect(portal?.onboardingDismissedAt).not.toBeNull();
  });
});
