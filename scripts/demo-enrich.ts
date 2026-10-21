/**
 * Local-only: thickens the demo portal so every chart has a year of data to draw.
 *
 *   npx tsx scripts/demo-enrich.ts
 *
 * Adds two employees, four projects and monthly plan/fact operations for the last two
 * years across every demo project. Never runs on its own (not part of `db:seed` or the demo
 * bootstrap), so the seed the tests rely on stays as it is. Idempotent: a second run is a
 * no-op, keyed on the first added project's name.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { DEMO_MEMBER_ID } from '../src/lib/demo/constants';
import { seedDemoPortal } from '../src/lib/demo/seed-data';

const db = new PrismaClient();
const MARKER = 'Маркетплейс «Орбита»';

/** Deterministic pseudo-random, so two machines get the same demo. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NEW_PROJECTS = [
  {
    name: MARKER,
    clientName: 'ООО «Орбита Маркет»',
    description: 'Витрина и личный кабинет продавца, интеграция с CRM.',
    base: 520_000,
  },
  {
    name: 'Телефония и сквозная аналитика «Нова»',
    clientName: 'АО «Нова Телеком»',
    description: 'Коллтрекинг, сквозная аналитика, отчёты для маркетинга.',
    base: 310_000,
  },
  {
    name: 'Сопровождение «Гранит»',
    clientName: 'ООО «Гранит Строй»',
    description: 'Абонентское сопровождение портала и доработки.',
    base: 180_000,
  },
  {
    name: 'Чат-бот поддержки «Лайм»',
    clientName: 'ООО «Лайм Сервис»',
    description: 'Бот первой линии: база знаний, эскалация на оператора.',
    base: 240_000,
  },
];

const EXTRA_EMPLOYEES = [
  { firstName: 'Ольга', lastName: 'Миронова', position: 'Дизайнер' },
  { firstName: 'Павел', lastName: 'Орлов', position: 'QA-инженер' },
];

const money = (n: number) => (Math.round(n / 1000) * 1000).toFixed(2);

async function main() {
  await seedDemoPortal(db);
  const portal = await db.portalInstallation.findUniqueOrThrow({
    where: { memberId: DEMO_MEMBER_ID },
  });
  const portalId = portal.id;
  if (await db.project.findFirst({ where: { portalId, name: MARKER } })) {
    console.log('• demo already enriched — nothing to do');
    return;
  }

  const manager = await db.appUser.findFirstOrThrow({ where: { portalId, role: 'MANAGER' } });
  let nextBitrixId = (await db.appUser.count({ where: { portalId } })) + 1;
  for (const e of EXTRA_EMPLOYEES) {
    await db.appUser.create({
      data: {
        portalId,
        bitrixUserId: String(nextBitrixId++),
        ...e,
        role: 'EMPLOYEE',
        lastSyncedAt: new Date(),
      },
    });
  }
  const employees = await db.appUser.findMany({
    where: { portalId, role: 'EMPLOYEE' },
    orderBy: { bitrixUserId: 'asc' },
  });
  const cats = await db.financeCategory.findMany({ where: { portalId } });
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;
  const income = cat('Доход');
  const expenseCats = [
    'Внешние программисты',
    'Внутренние программисты',
    'Расходы на ИИ',
    'Аренда сервера',
    'Дизайн',
    'Тестирование',
  ].map(cat);

  const now = new Date();
  const MONTHS = 24;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));

  for (const [i, p] of NEW_PROJECTS.entries()) {
    const project = await db.project.create({
      data: {
        portalId,
        name: p.name,
        clientName: p.clientName,
        description: p.description,
        status: 'ACTIVE',
        startDate: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 3)),
        createdById: manager.id,
      },
    });
    for (const e of employees.slice(i % 3, (i % 3) + 2)) {
      await db.projectMember.create({
        data: { portalId, projectId: project.id, userId: e.id, addedById: manager.id },
      });
    }
  }

  const projects = await db.project.findMany({ where: { portalId, status: 'ACTIVE' } });
  const rand = rng(42);
  const rows: Prisma.FinancialEntryCreateManyInput[] = [];
  for (const [pi, project] of projects.entries()) {
    const spec = NEW_PROJECTS.find((n) => n.name === project.name);
    const base = spec?.base ?? 200_000 + pi * 60_000;
    // Some projects earn well, one runs at a loss, the rest in between.
    const costRatio = pi % 5 === 3 ? 1.15 : 0.45 + rand() * 0.35;
    for (let mo = 0; mo < MONTHS; mo++) {
      const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + mo, 1));
      if (project.startDate && day < project.startDate) continue;
      // A gentle growth trend with a seasonal swing.
      const season = (0.7 + (0.3 * mo) / MONTHS) * (1 + 0.25 * Math.sin((mo / 12) * Math.PI * 2));
      const planIncome = base * season;
      const factIncome = mo === MONTHS - 1 ? planIncome * 0.4 : planIncome * (0.8 + rand() * 0.4);
      const at = (d: number) => new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), d));
      rows.push(
        {
          portalId,
          projectId: project.id,
          categoryId: income,
          direction: 'INCOME',
          budgetType: 'PLAN',
          operationDate: at(1),
          amount: money(planIncome),
          createdById: manager.id,
        },
        {
          portalId,
          projectId: project.id,
          categoryId: income,
          direction: 'INCOME',
          budgetType: 'FACT',
          operationDate: at(5 + Math.floor(rand() * 15)),
          amount: money(factIncome),
          counterpartyName: project.clientName,
          invoiceNumber: `СЧ-${300 + rows.length}`,
          createdById: manager.id,
        },
      );
      const spend = factIncome * costRatio;
      const split = [0.4, 0.25, 0.12, 0.08, 0.08, 0.07];
      for (const [ci, share] of split.entries()) {
        if (rand() < 0.15 && ci > 1) continue;
        rows.push({
          portalId,
          projectId: project.id,
          categoryId: expenseCats[ci]!,
          direction: 'EXPENSE',
          budgetType: 'FACT',
          operationDate: at(8 + Math.floor(rand() * 18)),
          amount: money(spend * share * (0.8 + rand() * 0.4)),
          employeeId: ci < 2 ? employees[(pi + ci) % employees.length]!.id : null,
          createdById: manager.id,
        });
      }
      rows.push({
        portalId,
        projectId: project.id,
        categoryId: expenseCats[0]!,
        direction: 'EXPENSE',
        budgetType: 'PLAN',
        operationDate: at(1),
        amount: money(planIncome * costRatio * 0.9),
        createdById: manager.id,
      });
    }
  }
  await db.financialEntry.createMany({ data: rows });
  console.log(
    `✓ demo enriched: +${NEW_PROJECTS.length} projects, +${EXTRA_EMPLOYEES.length} employees, +${rows.length} operations`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
