import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { syncAllPortals, syncPortalHours } from '@/server/services/time-sync';

process.env.SESSION_SECRET = 'time-sync-test-secret-at-least-32-bytes-xxx';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

async function makeCrmProject(portalId: string, entityTypeId: number, crmEntityId: string) {
  return testDb.project.create({
    data: { portalId, name: 'Внедрение CRM', sourceType: 'BITRIX_CRM', crmEntityType: 'DEAL', crmEntityTypeId: entityTypeId, crmEntityId },
  });
}

function mockTasksThenElapsed(taskIds: number[], elapsed: Record<number, Array<{ USER_ID: string; CREATED_DATE: string; MINUTES: string }>>) {
  const fetchSpy = vi.spyOn(global, 'fetch');
  fetchSpy.mockResolvedValueOnce(
    new Response(JSON.stringify({ result: { tasks: taskIds.map((id) => ({ id })) } }), { status: 200 }),
  );
  for (const id of taskIds) {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ result: elapsed[id] ?? [] }), { status: 200 }));
  }
  return fetchSpy;
}

describe('nightly hours sync (ADR-027)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('aggregates elapsed time per employee per day into a PENDING draft', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
    });
    await testDb.appUser.update({ where: { id: s.managerId }, data: { bitrixUserId: '42' } });
    const project = await makeCrmProject(s.portalId, 2, '101');

    mockTasksThenElapsed([5], {
      5: [
        { USER_ID: '42', CREATED_DATE: '2026-09-10T10:00:00+03:00', MINUTES: '60' },
        { USER_ID: '42', CREATED_DATE: '2026-09-10T15:00:00+03:00', MINUTES: '30' },
      ],
    });

    const result = await syncPortalHours(await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } }));
    expect(result.errors).toEqual([]);
    expect(result.draftsUpserted).toBe(1);

    const draft = await testDb.taskTimeDraft.findFirstOrThrow({ where: { projectId: project.id } });
    expect(draft.employeeId).toBe(s.managerId);
    expect(draft.hours.toString()).toBe('1.5');
    expect(draft.status).toBe('PENDING');
    expect(draft.bitrixTaskIds).toEqual([5]);
  });

  it('never overwrites an already-APPROVED draft', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
    });
    await testDb.appUser.update({ where: { id: s.managerId }, data: { bitrixUserId: '42' } });
    const project = await makeCrmProject(s.portalId, 2, '101');

    const approved = await testDb.taskTimeDraft.create({
      data: {
        portalId: s.portalId,
        projectId: project.id,
        employeeId: s.managerId,
        workDate: new Date('2026-09-10'),
        hours: '1.50',
        bitrixTaskIds: [5],
        status: 'APPROVED',
      },
    });

    mockTasksThenElapsed([5], {
      5: [{ USER_ID: '42', CREATED_DATE: '2026-09-10T10:00:00+03:00', MINUTES: '999' }],
    });

    await syncPortalHours(await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } }));

    const unchanged = await testDb.taskTimeDraft.findUniqueOrThrow({ where: { id: approved.id } });
    expect(unchanged.hours.toString()).toBe('1.5');
    expect(unchanged.status).toBe('APPROVED');
  });

  it('a task fetch failure for one project is recorded and does not abort the whole sync', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
    });
    await makeCrmProject(s.portalId, 2, '101');

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', error_description: 'boom' }), { status: 200 }),
    );

    const result = await syncPortalHours(await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } }));
    expect(result.errors).toHaveLength(1);
    expect(result.projectsSynced).toBe(0);
  });

  it('syncAllPortals skips FREE-plan and demo portals', async () => {
    const free = await seedPortal();
    const demo = await seedPortal({ isDemo: true });
    await testDb.portalInstallation.update({ where: { id: demo.portalId }, data: { authTokenEnc: encryptToken('ACCESS') } });
    // free stays plan FREE and portal has no authTokenEnc either — both disqualify it.

    const fetchSpy = vi.spyOn(global, 'fetch');
    const byPortal = await syncAllPortals();
    expect(byPortal[free.portalId]).toBeUndefined();
    expect(byPortal[demo.portalId]).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
