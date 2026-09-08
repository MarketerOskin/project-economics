import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { testDb, resetDb, seedPortal } from '../helpers/db';
import { withPortal } from '@/lib/db/with-portal';
import { loadDashboard } from '@/server/services/dashboard';

describe('loadDashboard (ТЗ §18–21, §53)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  async function seedData() {
    const s = await seedPortal();
    const scope = withPortal(s.portalId, testDb);
    const mk = (name: string, memberIds: string[] = []) =>
      testDb.project.create({
        data: {
          portalId: s.portalId,
          name,
          members: { create: memberIds.map((userId) => ({ portalId: s.portalId, userId })) },
        },
      });
    const alpha = await mk('Альфа', [s.employeeId]);
    const beta = await mk('Бета');

    const entry = (projectId: string, o: Partial<Parameters<typeof testDb.financialEntry.create>[0]['data']>) =>
      testDb.financialEntry.create({
        data: {
          portalId: s.portalId,
          projectId,
          categoryId: s.incomeCategoryId,
          direction: 'INCOME',
          budgetType: 'FACT',
          operationDate: new Date('2026-03-01'),
          amount: '0',
          ...o,
        } as Parameters<typeof testDb.financialEntry.create>[0]['data'],
      });

    // Альфа: +1,000,000 income, -600,000 expense -> profit 400,000
    await entry(alpha.id, { amount: '1000000' });
    await entry(alpha.id, { amount: '600000', direction: 'EXPENSE', categoryId: s.expenseCategoryId });
    // Бета: +200,000 income, -500,000 expense -> loss -300,000
    await entry(beta.id, { amount: '200000' });
    await entry(beta.id, { amount: '500000', direction: 'EXPENSE', categoryId: s.expenseCategoryId });

    return { s, scope, alpha, beta };
  }

  it('company KPI = sum of visible projects', async () => {
    const { s, scope } = await seedData();
    const d = await loadDashboard(scope, { role: 'ADMIN', appUserId: s.adminId }, {});
    expect(d.kpi.factIncome).toBe('1200000');
    expect(d.kpi.factExpense).toBe('1100000');
    expect(d.kpi.factProfit).toBe('100000');
  });

  it('project bars are sorted by profit desc', async () => {
    const { s, scope } = await seedData();
    const d = await loadDashboard(scope, { role: 'MANAGER', appUserId: s.managerId }, {});
    expect(d.projectBars.map((b) => b.name)).toEqual(['Альфа', 'Бета']);
    expect(d.projectBars[1]?.profit).toBe('-300000');
  });

  it('EMPLOYEE only sees their member project in every number', async () => {
    const { s, scope } = await seedData();
    const d = await loadDashboard(scope, { role: 'EMPLOYEE', appUserId: s.employeeId }, {});
    expect(d.projects.map((p) => p.name)).toEqual(['Альфа']);
    expect(d.kpi.factProfit).toBe('400000');
  });

  it('query count does not grow with the number of projects (no N+1, ТЗ §53)', async () => {
    const { s } = await seedData();
    // add 6 more projects with entries
    for (let i = 0; i < 6; i++) {
      const p = await testDb.project.create({ data: { portalId: s.portalId, name: `P${i}` } });
      await testDb.financialEntry.create({
        data: {
          portalId: s.portalId,
          projectId: p.id,
          categoryId: s.incomeCategoryId,
          direction: 'INCOME',
          budgetType: 'FACT',
          operationDate: new Date('2026-03-01'),
          amount: '100000',
        },
      });
    }

    const logged = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL } },
      log: [{ emit: 'event', level: 'query' }],
    });
    let selects = 0;
    logged.$on('query', (e) => {
      if (/^SELECT/i.test(e.query)) selects++;
    });
    await loadDashboard(withPortal(s.portalId, logged), { role: 'ADMIN', appUserId: s.adminId }, {});
    await logged.$disconnect();

    // projects + entries + categories = a small constant, not one-per-project
    expect(selects).toBeLessThanOrEqual(4);
  });

  it('expense structure carries names + colors and sums correctly', async () => {
    const { s, scope } = await seedData();
    const d = await loadDashboard(scope, { role: 'ADMIN', appUserId: s.adminId }, {});
    const total = d.expenseStructure.reduce((n, e) => n + Number(e.amount), 0);
    expect(total).toBe(1_100_000);
    expect(d.expenseStructure[0]?.color).toMatch(/^#/);
  });
});
