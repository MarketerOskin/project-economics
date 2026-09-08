import type { PrismaClient } from '@prisma/client';
import { DEMO_MEMBER_ID } from './constants';

/**
 * Realistic demo dataset (ТЗ §5, §68). Seven projects spanning every semantic state:
 * profitable, loss-making, on-plan, over-budget, no fact income, completed, archived/cancelled.
 * Idempotent: seeds only when the demo portal is absent, so a reviewer's edits survive reboots.
 */

type Tx = Pick<
  PrismaClient,
  | 'portalInstallation'
  | 'appUser'
  | 'financeCategory'
  | 'project'
  | 'projectMember'
  | 'financialEntry'
  | 'auditLog'
>;

const CATEGORIES = {
  income: { kind: 'INCOME' as const, name: 'Доход', accentColor: 'green', system: true },
  external: { kind: 'EXPENSE' as const, name: 'Внешние программисты', accentColor: 'blue', system: true },
  internal: { kind: 'EXPENSE' as const, name: 'Внутренние программисты', accentColor: 'violet', system: true },
  ai: { kind: 'EXPENSE' as const, name: 'Расходы на ИИ', accentColor: 'cyan', system: true },
  server: { kind: 'EXPENSE' as const, name: 'Аренда сервера', accentColor: 'graphite', system: true },
  dividends: { kind: 'EXPENSE' as const, name: 'Дивиденды', accentColor: 'burgundy', system: true },
  design: { kind: 'EXPENSE' as const, name: 'Дизайн', accentColor: 'orange', system: false },
  qa: { kind: 'EXPENSE' as const, name: 'Тестирование', accentColor: 'graphite', system: false },
};

type CategoryKey = keyof typeof CATEGORIES;

interface EntrySpec {
  category: CategoryKey;
  direction: 'INCOME' | 'EXPENSE';
  budget: 'PLAN' | 'FACT';
  date: string;
  amount?: string;
  hours?: string;
  rate?: string;
  employee?: number; // index into employees
  description?: string;
  contractorName?: string;
  counterpartyName?: string;
  invoiceNumber?: string;
  deleted?: boolean;
}

interface ProjectSpec {
  name: string;
  clientName: string;
  description: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  startDate: string;
  endDate?: string;
  members: number[]; // indices into employees
  entries: EntrySpec[];
}

const EMPLOYEES = [
  { firstName: 'Игорь', lastName: 'Лебедев', position: 'Senior-разработчик' },
  { firstName: 'Мария', lastName: 'Титова', position: 'Аналитик' },
  { firstName: 'Сергей', lastName: 'Волков', position: 'Разработчик' },
];

const PROJECTS: ProjectSpec[] = [
  {
    name: 'Внедрение CRM «Альфа»',
    clientName: 'ООО «Альфа-Трейд»',
    description: 'Полное внедрение Bitrix24: воронки продаж, телефония, автоматизация.',
    status: 'ACTIVE',
    startDate: '2026-01-15',
    members: [0, 1],
    entries: [
      { category: 'income', direction: 'INCOME', budget: 'PLAN', date: '2026-02-01', amount: '2400000' },
      { category: 'income', direction: 'INCOME', budget: 'FACT', date: '2026-02-10', amount: '1200000', counterpartyName: 'ООО «Альфа-Трейд»', invoiceNumber: 'СЧ-014' },
      { category: 'income', direction: 'INCOME', budget: 'FACT', date: '2026-04-05', amount: '1300000', counterpartyName: 'ООО «Альфа-Трейд»', invoiceNumber: 'СЧ-041' },
      { category: 'external', direction: 'EXPENSE', budget: 'PLAN', date: '2026-02-01', amount: '900000' },
      { category: 'external', direction: 'EXPENSE', budget: 'FACT', date: '2026-02-20', hours: '210', rate: '2200', employee: 0, description: 'Настройка воронок и прав' },
      { category: 'internal', direction: 'EXPENSE', budget: 'FACT', date: '2026-03-15', hours: '120', rate: '1800', employee: 1, description: 'Аналитика и обучение' },
      { category: 'ai', direction: 'EXPENSE', budget: 'PLAN', date: '2026-02-01', amount: '60000' },
      { category: 'ai', direction: 'EXPENSE', budget: 'FACT', date: '2026-03-01', amount: '48000', description: 'Классификация обращений' },
      { category: 'server', direction: 'EXPENSE', budget: 'FACT', date: '2026-03-01', amount: '18000' },
    ],
  },
  {
    name: 'Поддержка CRM «Север»',
    clientName: 'АО «Северснаб»',
    description: 'Ежемесячное сопровождение и доработки по регламенту SLA.',
    status: 'ACTIVE',
    startDate: '2026-01-01',
    members: [2],
    entries: [
      { category: 'income', direction: 'INCOME', budget: 'PLAN', date: '2026-03-01', amount: '600000' },
      { category: 'income', direction: 'INCOME', budget: 'FACT', date: '2026-03-05', amount: '600000', counterpartyName: 'АО «Северснаб»', invoiceNumber: 'СЧ-028' },
      { category: 'internal', direction: 'EXPENSE', budget: 'PLAN', date: '2026-03-01', amount: '360000' },
      { category: 'internal', direction: 'EXPENSE', budget: 'FACT', date: '2026-03-20', hours: '200', rate: '1800', employee: 2, description: 'Доработки по заявкам' },
      { category: 'server', direction: 'EXPENSE', budget: 'PLAN', date: '2026-03-01', amount: '20000' },
      { category: 'server', direction: 'EXPENSE', budget: 'FACT', date: '2026-03-01', amount: '20000' },
    ],
  },
  {
    name: 'Интеграция 1С — «Вектор»',
    clientName: 'ООО «Вектор Логистик»',
    description: 'Двусторонний обмен Bitrix24 ↔ 1С:УТ: товары, заказы, остатки, оплаты.',
    status: 'ACTIVE',
    startDate: '2026-02-01',
    members: [0, 2],
    entries: [
      { category: 'income', direction: 'INCOME', budget: 'PLAN', date: '2026-03-01', amount: '1500000' },
      { category: 'income', direction: 'INCOME', budget: 'FACT', date: '2026-03-10', amount: '750000', counterpartyName: 'ООО «Вектор Логистик»', invoiceNumber: 'СЧ-033' },
      { category: 'income', direction: 'INCOME', budget: 'FACT', date: '2026-05-15', amount: '600000', counterpartyName: 'ООО «Вектор Логистик»', invoiceNumber: 'СЧ-052' },
      { category: 'external', direction: 'EXPENSE', budget: 'PLAN', date: '2026-03-01', amount: '850000' },
      { category: 'external', direction: 'EXPENSE', budget: 'FACT', date: '2026-03-25', hours: '380', rate: '2400', employee: 0, contractorName: 'ИП Костин А.В.', description: 'Модуль обмена, очередь' },
      { category: 'external', direction: 'EXPENSE', budget: 'FACT', date: '2026-05-05', hours: '120', rate: '2400', employee: 0, description: 'Исправление расхождений остатков' },
      { category: 'ai', direction: 'EXPENSE', budget: 'FACT', date: '2026-04-01', amount: '35000' },
      { category: 'server', direction: 'EXPENSE', budget: 'FACT', date: '2026-04-01', amount: '24000' },
      { category: 'qa', direction: 'EXPENSE', budget: 'FACT', date: '2026-04-20', amount: '90000', description: 'Регресс обмена' },
      { category: 'qa', direction: 'EXPENSE', budget: 'FACT', date: '2026-04-22', amount: '15000', deleted: true, description: 'Ошибочно проведено дважды' },
    ],
  },
  {
    name: 'Корпоративный портал «Меридиан»',
    clientName: 'ГК «Меридиан»',
    description: 'Интранет: база знаний, структура компании, заявки, новости.',
    status: 'ACTIVE',
    startDate: '2026-05-01',
    members: [1],
    entries: [
      { category: 'income', direction: 'INCOME', budget: 'PLAN', date: '2026-06-01', amount: '1800000' },
      { category: 'external', direction: 'EXPENSE', budget: 'PLAN', date: '2026-06-01', amount: '700000' },
      { category: 'design', direction: 'EXPENSE', budget: 'PLAN', date: '2026-06-01', amount: '200000' },
      { category: 'design', direction: 'EXPENSE', budget: 'FACT', date: '2026-06-10', amount: '120000', contractorName: 'Студия «Форма»', description: 'Дизайн-концепция портала' },
      { category: 'server', direction: 'EXPENSE', budget: 'FACT', date: '2026-06-01', amount: '16000' },
    ],
  },
  {
    name: 'AI-ассистент отдела продаж',
    clientName: 'Внутренний проект',
    description: 'Помощник менеджера: черновики писем, резюме звонков, подсказки по сделке.',
    status: 'ACTIVE',
    startDate: '2026-03-01',
    members: [0, 1, 2],
    entries: [
      { category: 'income', direction: 'INCOME', budget: 'PLAN', date: '2026-05-01', amount: '500000' },
      { category: 'income', direction: 'INCOME', budget: 'FACT', date: '2026-05-20', amount: '150000', description: 'Пилот для двух отделов' },
      { category: 'external', direction: 'EXPENSE', budget: 'FACT', date: '2026-03-30', hours: '260', rate: '2600', employee: 0, description: 'Интеграция, промпт-оркестрация' },
      { category: 'ai', direction: 'EXPENSE', budget: 'PLAN', date: '2026-03-01', amount: '120000' },
      { category: 'ai', direction: 'EXPENSE', budget: 'FACT', date: '2026-04-01', amount: '95000', description: 'Токены, эмбеддинги' },
      { category: 'ai', direction: 'EXPENSE', budget: 'FACT', date: '2026-05-01', amount: '110000', description: 'Токены (рост нагрузки)' },
      { category: 'server', direction: 'EXPENSE', budget: 'FACT', date: '2026-04-01', amount: '30000' },
    ],
  },
  {
    name: 'Миграция с «Мегаплана»',
    clientName: 'ООО «Дом Стандарт»',
    description: 'Перенос сделок, контактов и задач из Мегаплана в Bitrix24. Сдан и оплачен.',
    status: 'COMPLETED',
    startDate: '2025-10-01',
    endDate: '2025-12-20',
    members: [2],
    entries: [
      { category: 'income', direction: 'INCOME', budget: 'PLAN', date: '2025-10-15', amount: '450000' },
      { category: 'income', direction: 'INCOME', budget: 'FACT', date: '2025-11-01', amount: '450000', counterpartyName: 'ООО «Дом Стандарт»', invoiceNumber: 'СЧ-201' },
      { category: 'external', direction: 'EXPENSE', budget: 'FACT', date: '2025-11-10', hours: '90', rate: '2100', employee: 2, description: 'Скрипты миграции, сверка' },
      { category: 'server', direction: 'EXPENSE', budget: 'FACT', date: '2025-11-01', amount: '9000' },
    ],
  },
  {
    name: 'Онбординг-портал «Ленмар»',
    clientName: 'ООО «Ленмар»',
    description: 'Проект остановлен на этапе анализа по решению клиента — часть затрат уже понесена.',
    status: 'ARCHIVED',
    startDate: '2025-09-01',
    endDate: '2025-10-05',
    members: [1],
    entries: [
      { category: 'income', direction: 'INCOME', budget: 'PLAN', date: '2025-09-15', amount: '800000' },
      { category: 'external', direction: 'EXPENSE', budget: 'PLAN', date: '2025-09-01', amount: '300000' },
      { category: 'external', direction: 'EXPENSE', budget: 'FACT', date: '2025-09-20', hours: '40', rate: '2200', employee: 1, description: 'Предпроектный анализ, интеграционная карта' },
      { category: 'server', direction: 'EXPENSE', budget: 'FACT', date: '2025-09-05', amount: '4000' },
    ],
  },
];

function round2(hours: string, rate: string): string {
  // Mirror the domain rule so seeded amounts match server recomputation exactly.
  const [h, r] = [Number(hours), Number(rate)];
  return (Math.round(h * r * 100) / 100).toFixed(2);
}

export async function seedDemoPortal(tx: Tx): Promise<{ created: boolean; portalId: string }> {
  const existing = await tx.portalInstallation.findUnique({ where: { memberId: DEMO_MEMBER_ID } });
  if (existing) return { created: false, portalId: existing.id };

  const portal = await tx.portalInstallation.create({
    data: {
      memberId: DEMO_MEMBER_ID,
      domain: 'demo.bitrix24.ru',
      isDemo: true,
      isActive: true,
      restEndpoint: 'https://demo.bitrix24.ru/rest/',
    },
  });
  const portalId = portal.id;

  const admin = await tx.appUser.create({
    data: {
      portalId,
      bitrixUserId: '1',
      firstName: 'Анна',
      lastName: 'Ковалёва',
      position: 'Директор',
      role: 'ADMIN',
      isBitrixAdmin: true,
      lastSyncedAt: new Date(),
    },
  });
  const manager = await tx.appUser.create({
    data: {
      portalId,
      bitrixUserId: '2',
      firstName: 'Дмитрий',
      lastName: 'Соколов',
      position: 'Руководитель проектов',
      role: 'MANAGER',
      lastSyncedAt: new Date(),
    },
  });
  const employees = [];
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const e = EMPLOYEES[i]!;
    employees.push(
      await tx.appUser.create({
        data: {
          portalId,
          bitrixUserId: String(i + 3),
          firstName: e.firstName,
          lastName: e.lastName,
          position: e.position,
          role: 'EMPLOYEE',
          lastSyncedAt: new Date(),
        },
      }),
    );
  }

  const categoryIds: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
  let order = 0;
  for (const key of Object.keys(CATEGORIES) as CategoryKey[]) {
    const c = CATEGORIES[key];
    const row = await tx.financeCategory.create({
      data: {
        portalId,
        kind: c.kind,
        name: c.name,
        accentColor: c.accentColor,
        sortOrder: order++,
        isSystem: c.system,
      },
    });
    categoryIds[key] = row.id;
  }

  for (const p of PROJECTS) {
    const project = await tx.project.create({
      data: {
        portalId,
        name: p.name,
        clientName: p.clientName,
        description: p.description,
        status: p.status,
        startDate: new Date(p.startDate),
        endDate: p.endDate ? new Date(p.endDate) : null,
        createdById: manager.id,
        archivedAt:
          p.status === 'ARCHIVED' ? new Date(p.endDate ?? '2025-12-21') : null,
        archivedById: p.status === 'ARCHIVED' ? admin.id : null,
      },
    });

    for (const idx of p.members) {
      await tx.projectMember.create({
        data: { portalId, projectId: project.id, userId: employees[idx]!.id, addedById: manager.id },
      });
    }

    await tx.auditLog.create({
      data: {
        portalId,
        actorId: manager.id,
        actorName: 'Дмитрий Соколов',
        action: 'PROJECT_CREATED',
        entityType: 'PROJECT',
        entityId: project.id,
        projectId: project.id,
        after: { name: p.name, status: p.status },
      },
    });

    for (const e of p.entries) {
      const isHours = e.hours != null && e.rate != null;
      const amount = isHours ? round2(e.hours!, e.rate!) : (e.amount ?? '0');
      const entry = await tx.financialEntry.create({
        data: {
          portalId,
          projectId: project.id,
          categoryId: categoryIds[e.category],
          direction: e.direction,
          budgetType: e.budget,
          calculationMode: isHours ? 'HOURS_RATE' : 'FIXED',
          operationDate: new Date(e.date),
          amount,
          hours: e.hours ?? null,
          hourlyRate: e.rate ?? null,
          employeeId: e.employee != null ? employees[e.employee]!.id : null,
          contractorName: e.contractorName ?? null,
          counterpartyName: e.counterpartyName ?? null,
          invoiceNumber: e.invoiceNumber ?? null,
          description: e.description ?? null,
          createdById: manager.id,
          deletedAt: e.deleted ? new Date(e.date) : null,
          deletedById: e.deleted ? manager.id : null,
        },
      });

      await tx.auditLog.create({
        data: {
          portalId,
          actorId: manager.id,
          actorName: 'Дмитрий Соколов',
          action: e.deleted ? 'FINANCE_DELETED' : 'FINANCE_CREATED',
          entityType: 'FINANCIAL_ENTRY',
          entityId: entry.id,
          projectId: project.id,
          after: { amount, direction: e.direction, budgetType: e.budget },
        },
      });
    }
  }

  return { created: true, portalId };
}
