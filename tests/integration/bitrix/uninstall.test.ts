import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { POST as eventsRoute } from '@/app/api/bitrix/events/route';

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new NextRequest('http://localhost/api/bitrix/events', { method: 'POST', body: fd });
}

async function portalWithData() {
  const s = await seedPortal();
  const memberId = (await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } })).memberId;
  await testDb.portalInstallation.update({
    where: { id: s.portalId },
    data: { applicationToken: 'APP_TOKEN', authTokenEnc: 'enc', refreshTokenEnc: 'enc' },
  });
  const project = await testDb.project.create({ data: { portalId: s.portalId, name: 'Проект' } });
  await testDb.projectMember.create({
    data: { portalId: s.portalId, projectId: project.id, userId: s.employeeId },
  });
  await testDb.financialEntry.create({
    data: {
      portalId: s.portalId,
      projectId: project.id,
      categoryId: s.expenseCategoryId,
      direction: 'EXPENSE',
      budgetType: 'FACT',
      operationDate: new Date('2026-01-01'),
      amount: '1000',
    },
  });
  await testDb.auditLog.create({
    data: { portalId: s.portalId, actorId: s.adminId, actorName: 'Админ', action: 'PROJECT_CREATED', entityType: 'PROJECT', entityId: project.id },
  });
  await testDb.apiCallLog.create({ data: { portalId: s.portalId, method: 'user.get', ok: true, durationMs: 1 } });
  return { ...s, memberId };
}

const uninstall = (memberId: string, clean: '0' | '1') =>
  form({
    event: 'ONAPPUNINSTALL',
    'data[CLEAN]': clean,
    'auth[member_id]': memberId,
    'auth[application_token]': 'APP_TOKEN',
  });

describe('ONAPPUNINSTALL: "Очистить данные приложения"', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('CLEAN=1 erases the portal and every row that belongs to it', async () => {
    const s = await portalWithData();
    const res = await eventsRoute(uninstall(s.memberId, '1'));
    expect(res.status).toBe(200);

    expect(await testDb.portalInstallation.count({ where: { id: s.portalId } })).toBe(0);
    for (const table of ['appUser', 'project', 'projectMember', 'financeCategory', 'financialEntry', 'auditLog', 'apiCallLog'] as const) {
      // @ts-expect-error — indexing delegates by name for a compact loop
      expect(await testDb[table].count({ where: { portalId: s.portalId } }), table).toBe(0);
    }
  });

  it('CLEAN=0 keeps the data but drops tokens and deactivates the portal', async () => {
    const s = await portalWithData();
    const res = await eventsRoute(uninstall(s.memberId, '0'));
    expect(res.status).toBe(200);

    const portal = await testDb.portalInstallation.findUnique({ where: { id: s.portalId } });
    expect(portal?.isActive).toBe(false);
    expect(portal?.authTokenEnc).toBeNull();
    expect(portal?.refreshTokenEnc).toBeNull();
    expect(await testDb.financialEntry.count({ where: { portalId: s.portalId } })).toBe(1);
    expect(await testDb.project.count({ where: { portalId: s.portalId } })).toBe(1);
  });

  it('CLEAN=1 with a wrong application_token erases nothing', async () => {
    const s = await portalWithData();
    const res = await eventsRoute(
      form({ event: 'ONAPPUNINSTALL', 'data[CLEAN]': '1', 'auth[member_id]': s.memberId, 'auth[application_token]': 'GUESS' }),
    );
    expect(res.status).toBe(401);
    expect(await testDb.portalInstallation.count({ where: { id: s.portalId } })).toBe(1);
    expect(await testDb.financialEntry.count({ where: { portalId: s.portalId } })).toBe(1);
  });
});
