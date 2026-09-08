import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testDb, resetDb, seedPortal } from '../helpers/db';

describe('test database', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('applies the schema and seeds a portal with one user per role', async () => {
    const s = await seedPortal();
    const users = await testDb.appUser.findMany({ where: { portalId: s.portalId } });
    expect(users.map((u) => u.role).sort()).toEqual(['ADMIN', 'EMPLOYEE', 'MANAGER']);
  });

  it('stores money as Decimal without float drift', async () => {
    const s = await seedPortal();
    const project = await testDb.project.create({
      data: { portalId: s.portalId, name: 'Проект' },
    });
    await testDb.financialEntry.create({
      data: {
        portalId: s.portalId,
        projectId: project.id,
        categoryId: s.incomeCategoryId,
        direction: 'INCOME',
        budgetType: 'FACT',
        operationDate: new Date('2026-01-10'),
        amount: '0.10',
      },
    });
    await testDb.financialEntry.create({
      data: {
        portalId: s.portalId,
        projectId: project.id,
        categoryId: s.incomeCategoryId,
        direction: 'INCOME',
        budgetType: 'FACT',
        operationDate: new Date('2026-01-11'),
        amount: '0.20',
      },
    });
    const agg = await testDb.financialEntry.aggregate({
      where: { projectId: project.id },
      _sum: { amount: true },
    });
    expect(agg._sum.amount?.toString()).toBe('0.3');
  });
});
