import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { syncAllPortalsIncome, syncPortalIncome } from '@/server/services/income-sync';

process.env.SESSION_SECRET = 'income-sync-test-secret-at-least-32-bytes-x';
process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

async function makeCrmProject(portalId: string, entityTypeId: number, crmEntityId: string) {
  return testDb.project.create({
    data: { portalId, name: 'Внедрение CRM', sourceType: 'BITRIX_CRM', crmEntityType: 'DEAL', crmEntityTypeId: entityTypeId, crmEntityId },
  });
}

function mockCrmItemGet(opportunity: string | null) {
  return vi
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { item: { id: 101, title: 'Сделка', opportunity } } }), { status: 200 }),
    );
}

describe('nightly income sync (ADR-028)', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_MODE = 'false';
  });
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('creates a PENDING draft with the deal amount', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
    });
    const project = await makeCrmProject(s.portalId, 2, '101');
    mockCrmItemGet('450000.0000');

    const result = await syncPortalIncome(await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } }));
    expect(result.errors).toEqual([]);
    expect(result.draftsUpserted).toBe(1);

    const draft = await testDb.crmIncomeDraft.findFirstOrThrow({ where: { projectId: project.id } });
    expect(draft.crmAmount.toString()).toBe('450000');
    expect(draft.status).toBe('PENDING');
  });

  it('does not touch an APPROVED draft when the Bitrix amount is unchanged', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
    });
    const project = await makeCrmProject(s.portalId, 2, '101');
    const approved = await testDb.crmIncomeDraft.create({
      data: { portalId: s.portalId, projectId: project.id, crmAmount: '450000.00', status: 'APPROVED' },
    });
    mockCrmItemGet('450000.0000');

    const result = await syncPortalIncome(await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } }));
    expect(result.draftsUpserted).toBe(0);

    const unchanged = await testDb.crmIncomeDraft.findUniqueOrThrow({ where: { id: approved.id } });
    expect(unchanged.status).toBe('APPROVED');
  });

  it('re-opens an APPROVED draft to PENDING when the Bitrix amount changes', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
    });
    const project = await makeCrmProject(s.portalId, 2, '101');
    const approved = await testDb.crmIncomeDraft.create({
      data: { portalId: s.portalId, projectId: project.id, crmAmount: '450000.00', status: 'APPROVED' },
    });
    mockCrmItemGet('500000.0000');

    const result = await syncPortalIncome(await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } }));
    expect(result.draftsUpserted).toBe(1);

    const reopened = await testDb.crmIncomeDraft.findUniqueOrThrow({ where: { id: approved.id } });
    expect(reopened.status).toBe('PENDING');
    expect(reopened.crmAmount.toString()).toBe('500000');
  });

  it('a fetch failure for one project is recorded and does not abort the whole sync', async () => {
    const s = await seedPortal();
    await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/', plan: 'PRO' },
    });
    await makeCrmProject(s.portalId, 2, '101');
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', error_description: 'boom' }), { status: 200 }),
    );

    const result = await syncPortalIncome(await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } }));
    expect(result.errors).toHaveLength(1);
  });

  it('syncAllPortalsIncome skips FREE-plan and demo portals', async () => {
    const free = await seedPortal();
    const demo = await seedPortal({ isDemo: true });
    await testDb.portalInstallation.update({ where: { id: demo.portalId }, data: { authTokenEnc: encryptToken('ACCESS') } });

    const fetchSpy = vi.spyOn(global, 'fetch');
    const byPortal = await syncAllPortalsIncome();
    expect(byPortal[free.portalId]).toBeUndefined();
    expect(byPortal[demo.portalId]).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
