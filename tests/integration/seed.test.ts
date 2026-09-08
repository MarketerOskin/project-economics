import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testDb, resetDb } from '../helpers/db';
import { seedDemoPortal } from '@/lib/demo/seed-data';
import { withPortal } from '@/lib/db/with-portal';
import { aggregateProject } from '@/domain/finance';
import type { EntryInput } from '@/domain/finance';

async function economicsFor(portalId: string, projectName: string) {
  const scope = withPortal(portalId, testDb);
  const project = (await scope.project.findMany({ where: { name: projectName } }))[0]!;
  const rows = await scope.entry.findMany({ where: { projectId: project.id } });
  const input: EntryInput[] = rows.map((r) => ({
    direction: r.direction,
    budgetType: r.budgetType,
    amount: r.amount,
    categoryId: r.categoryId,
    operationDate: r.operationDate,
    deletedAt: r.deletedAt,
  }));
  return { project, economics: aggregateProject(input) };
}

describe('demo seed (ТЗ §5, §68)', () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('creates the demo portal once and is idempotent', async () => {
    const first = await seedDemoPortal(testDb);
    expect(first.created).toBe(true);
    const second = await seedDemoPortal(testDb);
    expect(second.created).toBe(false);
    expect(second.portalId).toBe(first.portalId);
  });

  it('seeds 7 projects, one per role, and the six starter categories', async () => {
    const { portalId } = await seedDemoPortal(testDb);
    const scope = withPortal(portalId, testDb);
    expect(await scope.project.count()).toBe(7);
    const users = await scope.user.findMany();
    expect(users.filter((u) => u.role === 'ADMIN')).toHaveLength(1);
    expect(users.filter((u) => u.role === 'MANAGER')).toHaveLength(1);
    expect(users.filter((u) => u.role === 'EMPLOYEE')).toHaveLength(3);
    const cats = await scope.category.findMany();
    expect(cats.filter((c) => c.isSystem).map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'Доход',
        'Внешние программисты',
        'Внутренние программисты',
        'Расходы на ИИ',
        'Аренда сервера',
        'Дивиденды',
      ]),
    );
  });

  it('covers every semantic state', async () => {
    const { portalId } = await seedDemoPortal(testDb);

    const alpha = await economicsFor(portalId, 'Внедрение CRM «Альфа»');
    expect(alpha.economics.factProfit.isPositive()).toBe(true);
    expect(alpha.economics.factMargin).not.toBeNull();

    const ai = await economicsFor(portalId, 'AI-ассистент отдела продаж');
    expect(ai.economics.factProfit.isNegative()).toBe(true);

    const meridian = await economicsFor(portalId, 'Корпоративный портал «Меридиан»');
    expect(meridian.economics.factIncome.isZero()).toBe(true);
    expect(meridian.economics.factMargin).toBeNull();

    const vector = await economicsFor(portalId, 'Интеграция 1С — «Вектор»');
    expect(vector.economics.expenseDeviation.isPositive()).toBe(true); // over budget

    const completed = await economicsFor(portalId, 'Миграция с «Мегаплана»');
    expect(completed.project.status).toBe('COMPLETED');
    expect(completed.economics.factProfit.isPositive()).toBe(true);

    const archived = await economicsFor(portalId, 'Онбординг-портал «Ленмар»');
    expect(archived.project.status).toBe('ARCHIVED');
    expect(archived.economics.factIncome.isZero()).toBe(true);
  });

  it('stores HOURS_RATE amounts equal to hours × rate', async () => {
    const { portalId } = await seedDemoPortal(testDb);
    const scope = withPortal(portalId, testDb);
    const hourly = await scope.entry.findMany({ where: { calculationMode: 'HOURS_RATE' } });
    expect(hourly.length).toBeGreaterThan(0);
    for (const e of hourly) {
      expect(e.amount.toString()).toBe(e.hours!.times(e.hourlyRate!).toString());
    }
  });

  it('includes at least one soft-deleted entry and audit rows', async () => {
    const { portalId } = await seedDemoPortal(testDb);
    const scope = withPortal(portalId, testDb);
    expect(await scope.entry.count({ deletedAt: { not: null } })).toBeGreaterThan(0);
    expect(await scope.audit.count()).toBeGreaterThan(10);
  });
});
