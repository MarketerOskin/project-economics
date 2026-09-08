/**
 * Helpers for integration tests: a shared client on the test DB, table truncation,
 * and a minimal portal factory. Import from test files (not a setup file).
 */
import { PrismaClient } from '@prisma/client';

export const testDb = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
  log: ['error'],
});

/** Order-independent wipe of every row (FK-safe via CASCADE). */
export async function resetDb(): Promise<void> {
  await testDb.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog","FinancialEntry","ProjectMember","Project",
      "FinanceCategory","AppUser","PortalInstallation"
    RESTART IDENTITY CASCADE;
  `);
}

export interface SeededPortal {
  portalId: string;
  adminId: string;
  managerId: string;
  employeeId: string;
  incomeCategoryId: string;
  expenseCategoryId: string;
}

/** One portal, one user per role, one income + one expense category. */
export async function seedPortal(overrides?: { isDemo?: boolean }): Promise<SeededPortal> {
  const portal = await testDb.portalInstallation.create({
    data: {
      memberId: `test-${Math.random().toString(36).slice(2, 10)}`,
      domain: 'test.bitrix24.ru',
      isDemo: overrides?.isDemo ?? false,
    },
  });

  const mkUser = (role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE', n: number) =>
    testDb.appUser.create({
      data: {
        portalId: portal.id,
        bitrixUserId: String(n),
        firstName: role[0] + role.slice(1).toLowerCase(),
        lastName: 'Тестовый',
        role,
        isBitrixAdmin: role === 'ADMIN',
      },
    });

  const [admin, manager, employee] = await Promise.all([
    mkUser('ADMIN', 1),
    mkUser('MANAGER', 2),
    mkUser('EMPLOYEE', 3),
  ]);

  const income = await testDb.financeCategory.create({
    data: { portalId: portal.id, kind: 'INCOME', name: 'Доход', accentColor: 'green', isSystem: true },
  });
  const expense = await testDb.financeCategory.create({
    data: {
      portalId: portal.id,
      kind: 'EXPENSE',
      name: 'Внешние программисты',
      accentColor: 'blue',
      isSystem: true,
    },
  });

  return {
    portalId: portal.id,
    adminId: admin.id,
    managerId: manager.id,
    employeeId: employee.id,
    incomeCategoryId: income.id,
    expenseCategoryId: expense.id,
  };
}
