// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

// src/lib/demo/constants.ts
var DEMO_MEMBER_ID = "demo";

// src/lib/demo/seed-data.ts
var CATEGORIES = {
  income: { kind: "INCOME", name: "\u0414\u043E\u0445\u043E\u0434", accentColor: "green", system: true },
  external: { kind: "EXPENSE", name: "\u0412\u043D\u0435\u0448\u043D\u0438\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0438\u0441\u0442\u044B", accentColor: "blue", system: true },
  internal: { kind: "EXPENSE", name: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0438\u0441\u0442\u044B", accentColor: "violet", system: true },
  ai: { kind: "EXPENSE", name: "\u0420\u0430\u0441\u0445\u043E\u0434\u044B \u043D\u0430 \u0418\u0418", accentColor: "cyan", system: true },
  server: { kind: "EXPENSE", name: "\u0410\u0440\u0435\u043D\u0434\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430", accentColor: "graphite", system: true },
  dividends: { kind: "EXPENSE", name: "\u0414\u0438\u0432\u0438\u0434\u0435\u043D\u0434\u044B", accentColor: "burgundy", system: true },
  design: { kind: "EXPENSE", name: "\u0414\u0438\u0437\u0430\u0439\u043D", accentColor: "orange", system: false },
  qa: { kind: "EXPENSE", name: "\u0422\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435", accentColor: "graphite", system: false }
};
var EMPLOYEES = [
  { firstName: "\u0418\u0433\u043E\u0440\u044C", lastName: "\u041B\u0435\u0431\u0435\u0434\u0435\u0432", position: "Senior-\u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A" },
  { firstName: "\u041C\u0430\u0440\u0438\u044F", lastName: "\u0422\u0438\u0442\u043E\u0432\u0430", position: "\u0410\u043D\u0430\u043B\u0438\u0442\u0438\u043A" },
  { firstName: "\u0421\u0435\u0440\u0433\u0435\u0439", lastName: "\u0412\u043E\u043B\u043A\u043E\u0432", position: "\u0420\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A" }
];
var PROJECTS = [
  {
    name: "\u0412\u043D\u0435\u0434\u0440\u0435\u043D\u0438\u0435 CRM \xAB\u0410\u043B\u044C\u0444\u0430\xBB",
    clientName: "\u041E\u041E\u041E \xAB\u0410\u043B\u044C\u0444\u0430-\u0422\u0440\u0435\u0439\u0434\xBB",
    description: "\u041F\u043E\u043B\u043D\u043E\u0435 \u0432\u043D\u0435\u0434\u0440\u0435\u043D\u0438\u0435 Bitrix24: \u0432\u043E\u0440\u043E\u043D\u043A\u0438 \u043F\u0440\u043E\u0434\u0430\u0436, \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0438\u044F, \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u044F.",
    status: "ACTIVE",
    startDate: "2026-01-15",
    members: [0, 1],
    entries: [
      { category: "income", direction: "INCOME", budget: "PLAN", date: "2026-02-01", amount: "2400000" },
      { category: "income", direction: "INCOME", budget: "FACT", date: "2026-02-10", amount: "1200000", counterpartyName: "\u041E\u041E\u041E \xAB\u0410\u043B\u044C\u0444\u0430-\u0422\u0440\u0435\u0439\u0434\xBB", invoiceNumber: "\u0421\u0427-014" },
      { category: "income", direction: "INCOME", budget: "FACT", date: "2026-04-05", amount: "1300000", counterpartyName: "\u041E\u041E\u041E \xAB\u0410\u043B\u044C\u0444\u0430-\u0422\u0440\u0435\u0439\u0434\xBB", invoiceNumber: "\u0421\u0427-041" },
      { category: "external", direction: "EXPENSE", budget: "PLAN", date: "2026-02-01", amount: "900000" },
      { category: "external", direction: "EXPENSE", budget: "FACT", date: "2026-02-20", hours: "210", rate: "2200", employee: 0, description: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0432\u043E\u0440\u043E\u043D\u043E\u043A \u0438 \u043F\u0440\u0430\u0432" },
      { category: "internal", direction: "EXPENSE", budget: "FACT", date: "2026-03-15", hours: "120", rate: "1800", employee: 1, description: "\u0410\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430 \u0438 \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u0435" },
      { category: "ai", direction: "EXPENSE", budget: "PLAN", date: "2026-02-01", amount: "60000" },
      { category: "ai", direction: "EXPENSE", budget: "FACT", date: "2026-03-01", amount: "48000", description: "\u041A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0439" },
      { category: "server", direction: "EXPENSE", budget: "FACT", date: "2026-03-01", amount: "18000" }
    ]
  },
  {
    name: "\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 CRM \xAB\u0421\u0435\u0432\u0435\u0440\xBB",
    clientName: "\u0410\u041E \xAB\u0421\u0435\u0432\u0435\u0440\u0441\u043D\u0430\u0431\xBB",
    description: "\u0415\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u043E\u0435 \u0441\u043E\u043F\u0440\u043E\u0432\u043E\u0436\u0434\u0435\u043D\u0438\u0435 \u0438 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u043E \u0440\u0435\u0433\u043B\u0430\u043C\u0435\u043D\u0442\u0443 SLA.",
    status: "ACTIVE",
    startDate: "2026-01-01",
    members: [2],
    entries: [
      { category: "income", direction: "INCOME", budget: "PLAN", date: "2026-03-01", amount: "600000" },
      { category: "income", direction: "INCOME", budget: "FACT", date: "2026-03-05", amount: "600000", counterpartyName: "\u0410\u041E \xAB\u0421\u0435\u0432\u0435\u0440\u0441\u043D\u0430\u0431\xBB", invoiceNumber: "\u0421\u0427-028" },
      { category: "internal", direction: "EXPENSE", budget: "PLAN", date: "2026-03-01", amount: "360000" },
      { category: "internal", direction: "EXPENSE", budget: "FACT", date: "2026-03-20", hours: "200", rate: "1800", employee: 2, description: "\u0414\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u043E \u0437\u0430\u044F\u0432\u043A\u0430\u043C" },
      { category: "server", direction: "EXPENSE", budget: "PLAN", date: "2026-03-01", amount: "20000" },
      { category: "server", direction: "EXPENSE", budget: "FACT", date: "2026-03-01", amount: "20000" }
    ]
  },
  {
    name: "\u0418\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044F 1\u0421 \u2014 \xAB\u0412\u0435\u043A\u0442\u043E\u0440\xBB",
    clientName: "\u041E\u041E\u041E \xAB\u0412\u0435\u043A\u0442\u043E\u0440 \u041B\u043E\u0433\u0438\u0441\u0442\u0438\u043A\xBB",
    description: "\u0414\u0432\u0443\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0439 \u043E\u0431\u043C\u0435\u043D Bitrix24 \u2194 1\u0421:\u0423\u0422: \u0442\u043E\u0432\u0430\u0440\u044B, \u0437\u0430\u043A\u0430\u0437\u044B, \u043E\u0441\u0442\u0430\u0442\u043A\u0438, \u043E\u043F\u043B\u0430\u0442\u044B.",
    status: "ACTIVE",
    startDate: "2026-02-01",
    members: [0, 2],
    entries: [
      { category: "income", direction: "INCOME", budget: "PLAN", date: "2026-03-01", amount: "1500000" },
      { category: "income", direction: "INCOME", budget: "FACT", date: "2026-03-10", amount: "750000", counterpartyName: "\u041E\u041E\u041E \xAB\u0412\u0435\u043A\u0442\u043E\u0440 \u041B\u043E\u0433\u0438\u0441\u0442\u0438\u043A\xBB", invoiceNumber: "\u0421\u0427-033" },
      { category: "income", direction: "INCOME", budget: "FACT", date: "2026-05-15", amount: "600000", counterpartyName: "\u041E\u041E\u041E \xAB\u0412\u0435\u043A\u0442\u043E\u0440 \u041B\u043E\u0433\u0438\u0441\u0442\u0438\u043A\xBB", invoiceNumber: "\u0421\u0427-052" },
      { category: "external", direction: "EXPENSE", budget: "PLAN", date: "2026-03-01", amount: "850000" },
      { category: "external", direction: "EXPENSE", budget: "FACT", date: "2026-03-25", hours: "380", rate: "2400", employee: 0, contractorName: "\u0418\u041F \u041A\u043E\u0441\u0442\u0438\u043D \u0410.\u0412.", description: "\u041C\u043E\u0434\u0443\u043B\u044C \u043E\u0431\u043C\u0435\u043D\u0430, \u043E\u0447\u0435\u0440\u0435\u0434\u044C" },
      { category: "external", direction: "EXPENSE", budget: "FACT", date: "2026-05-05", hours: "120", rate: "2400", employee: 0, description: "\u0418\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0440\u0430\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0439 \u043E\u0441\u0442\u0430\u0442\u043A\u043E\u0432" },
      { category: "ai", direction: "EXPENSE", budget: "FACT", date: "2026-04-01", amount: "35000" },
      { category: "server", direction: "EXPENSE", budget: "FACT", date: "2026-04-01", amount: "24000" },
      { category: "qa", direction: "EXPENSE", budget: "FACT", date: "2026-04-20", amount: "90000", description: "\u0420\u0435\u0433\u0440\u0435\u0441\u0441 \u043E\u0431\u043C\u0435\u043D\u0430" },
      { category: "qa", direction: "EXPENSE", budget: "FACT", date: "2026-04-22", amount: "15000", deleted: true, description: "\u041E\u0448\u0438\u0431\u043E\u0447\u043D\u043E \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u043E \u0434\u0432\u0430\u0436\u0434\u044B" }
    ]
  },
  {
    name: "\u041A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u043F\u043E\u0440\u0442\u0430\u043B \xAB\u041C\u0435\u0440\u0438\u0434\u0438\u0430\u043D\xBB",
    clientName: "\u0413\u041A \xAB\u041C\u0435\u0440\u0438\u0434\u0438\u0430\u043D\xBB",
    description: "\u0418\u043D\u0442\u0440\u0430\u043D\u0435\u0442: \u0431\u0430\u0437\u0430 \u0437\u043D\u0430\u043D\u0438\u0439, \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438, \u0437\u0430\u044F\u0432\u043A\u0438, \u043D\u043E\u0432\u043E\u0441\u0442\u0438.",
    status: "ACTIVE",
    startDate: "2026-05-01",
    members: [1],
    entries: [
      { category: "income", direction: "INCOME", budget: "PLAN", date: "2026-06-01", amount: "1800000" },
      { category: "external", direction: "EXPENSE", budget: "PLAN", date: "2026-06-01", amount: "700000" },
      { category: "design", direction: "EXPENSE", budget: "PLAN", date: "2026-06-01", amount: "200000" },
      { category: "design", direction: "EXPENSE", budget: "FACT", date: "2026-06-10", amount: "120000", contractorName: "\u0421\u0442\u0443\u0434\u0438\u044F \xAB\u0424\u043E\u0440\u043C\u0430\xBB", description: "\u0414\u0438\u0437\u0430\u0439\u043D-\u043A\u043E\u043D\u0446\u0435\u043F\u0446\u0438\u044F \u043F\u043E\u0440\u0442\u0430\u043B\u0430" },
      { category: "server", direction: "EXPENSE", budget: "FACT", date: "2026-06-01", amount: "16000" }
    ]
  },
  {
    name: "AI-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442 \u043E\u0442\u0434\u0435\u043B\u0430 \u043F\u0440\u043E\u0434\u0430\u0436",
    clientName: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u043F\u0440\u043E\u0435\u043A\u0442",
    description: "\u041F\u043E\u043C\u043E\u0449\u043D\u0438\u043A \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440\u0430: \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A\u0438 \u043F\u0438\u0441\u0435\u043C, \u0440\u0435\u0437\u044E\u043C\u0435 \u0437\u0432\u043E\u043D\u043A\u043E\u0432, \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438 \u043F\u043E \u0441\u0434\u0435\u043B\u043A\u0435.",
    status: "ACTIVE",
    startDate: "2026-03-01",
    members: [0, 1, 2],
    entries: [
      { category: "income", direction: "INCOME", budget: "PLAN", date: "2026-05-01", amount: "500000" },
      { category: "income", direction: "INCOME", budget: "FACT", date: "2026-05-20", amount: "150000", description: "\u041F\u0438\u043B\u043E\u0442 \u0434\u043B\u044F \u0434\u0432\u0443\u0445 \u043E\u0442\u0434\u0435\u043B\u043E\u0432" },
      { category: "external", direction: "EXPENSE", budget: "FACT", date: "2026-03-30", hours: "260", rate: "2600", employee: 0, description: "\u0418\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044F, \u043F\u0440\u043E\u043C\u043F\u0442-\u043E\u0440\u043A\u0435\u0441\u0442\u0440\u0430\u0446\u0438\u044F" },
      { category: "ai", direction: "EXPENSE", budget: "PLAN", date: "2026-03-01", amount: "120000" },
      { category: "ai", direction: "EXPENSE", budget: "FACT", date: "2026-04-01", amount: "95000", description: "\u0422\u043E\u043A\u0435\u043D\u044B, \u044D\u043C\u0431\u0435\u0434\u0434\u0438\u043D\u0433\u0438" },
      { category: "ai", direction: "EXPENSE", budget: "FACT", date: "2026-05-01", amount: "110000", description: "\u0422\u043E\u043A\u0435\u043D\u044B (\u0440\u043E\u0441\u0442 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438)" },
      { category: "server", direction: "EXPENSE", budget: "FACT", date: "2026-04-01", amount: "30000" }
    ]
  },
  {
    name: "\u041C\u0438\u0433\u0440\u0430\u0446\u0438\u044F \u0441 \xAB\u041C\u0435\u0433\u0430\u043F\u043B\u0430\u043D\u0430\xBB",
    clientName: "\u041E\u041E\u041E \xAB\u0414\u043E\u043C \u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\xBB",
    description: "\u041F\u0435\u0440\u0435\u043D\u043E\u0441 \u0441\u0434\u0435\u043B\u043E\u043A, \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043E\u0432 \u0438 \u0437\u0430\u0434\u0430\u0447 \u0438\u0437 \u041C\u0435\u0433\u0430\u043F\u043B\u0430\u043D\u0430 \u0432 Bitrix24. \u0421\u0434\u0430\u043D \u0438 \u043E\u043F\u043B\u0430\u0447\u0435\u043D.",
    status: "COMPLETED",
    startDate: "2026-01-15",
    endDate: "2026-03-20",
    members: [2],
    entries: [
      { category: "income", direction: "INCOME", budget: "PLAN", date: "2026-01-20", amount: "450000" },
      { category: "income", direction: "INCOME", budget: "FACT", date: "2026-03-10", amount: "450000", counterpartyName: "\u041E\u041E\u041E \xAB\u0414\u043E\u043C \u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\xBB", invoiceNumber: "\u0421\u0427-201" },
      { category: "external", direction: "EXPENSE", budget: "FACT", date: "2026-02-25", hours: "90", rate: "2100", employee: 2, description: "\u0421\u043A\u0440\u0438\u043F\u0442\u044B \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u0438, \u0441\u0432\u0435\u0440\u043A\u0430" },
      { category: "server", direction: "EXPENSE", budget: "FACT", date: "2026-02-01", amount: "9000" }
    ]
  },
  {
    name: "\u041E\u043D\u0431\u043E\u0440\u0434\u0438\u043D\u0433-\u043F\u043E\u0440\u0442\u0430\u043B \xAB\u041B\u0435\u043D\u043C\u0430\u0440\xBB",
    clientName: "\u041E\u041E\u041E \xAB\u041B\u0435\u043D\u043C\u0430\u0440\xBB",
    description: "\u041F\u0440\u043E\u0435\u043A\u0442 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u043D\u0430 \u044D\u0442\u0430\u043F\u0435 \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u043F\u043E \u0440\u0435\u0448\u0435\u043D\u0438\u044E \u043A\u043B\u0438\u0435\u043D\u0442\u0430 \u2014 \u0447\u0430\u0441\u0442\u044C \u0437\u0430\u0442\u0440\u0430\u0442 \u0443\u0436\u0435 \u043F\u043E\u043D\u0435\u0441\u0435\u043D\u0430.",
    status: "ARCHIVED",
    startDate: "2026-01-12",
    endDate: "2026-02-14",
    members: [1],
    entries: [
      { category: "income", direction: "INCOME", budget: "PLAN", date: "2026-01-20", amount: "800000" },
      { category: "external", direction: "EXPENSE", budget: "PLAN", date: "2026-01-12", amount: "300000" },
      { category: "external", direction: "EXPENSE", budget: "FACT", date: "2026-02-05", hours: "40", rate: "2200", employee: 1, description: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0435\u043A\u0442\u043D\u044B\u0439 \u0430\u043D\u0430\u043B\u0438\u0437, \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430" },
      { category: "server", direction: "EXPENSE", budget: "FACT", date: "2026-01-20", amount: "4000" }
    ]
  }
];
function round2(hours, rate) {
  const [h, r] = [Number(hours), Number(rate)];
  return (Math.round(h * r * 100) / 100).toFixed(2);
}
async function seedDemoPortal(tx) {
  const existing = await tx.portalInstallation.findUnique({ where: { memberId: DEMO_MEMBER_ID } });
  if (existing) return { created: false, portalId: existing.id };
  const portal = await tx.portalInstallation.create({
    data: {
      memberId: DEMO_MEMBER_ID,
      domain: "demo.bitrix24.ru",
      isDemo: true,
      isActive: true,
      restEndpoint: "https://demo.bitrix24.ru/rest/"
    }
  });
  const portalId = portal.id;
  const admin = await tx.appUser.create({
    data: {
      portalId,
      bitrixUserId: "1",
      firstName: "\u0410\u043D\u043D\u0430",
      lastName: "\u041A\u043E\u0432\u0430\u043B\u0451\u0432\u0430",
      position: "\u0414\u0438\u0440\u0435\u043A\u0442\u043E\u0440",
      role: "ADMIN",
      isBitrixAdmin: true,
      lastSyncedAt: /* @__PURE__ */ new Date()
    }
  });
  const manager = await tx.appUser.create({
    data: {
      portalId,
      bitrixUserId: "2",
      firstName: "\u0414\u043C\u0438\u0442\u0440\u0438\u0439",
      lastName: "\u0421\u043E\u043A\u043E\u043B\u043E\u0432",
      position: "\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432",
      role: "MANAGER",
      lastSyncedAt: /* @__PURE__ */ new Date()
    }
  });
  const employees = [];
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const e = EMPLOYEES[i];
    employees.push(
      await tx.appUser.create({
        data: {
          portalId,
          bitrixUserId: String(i + 3),
          firstName: e.firstName,
          lastName: e.lastName,
          position: e.position,
          role: "EMPLOYEE",
          lastSyncedAt: /* @__PURE__ */ new Date()
        }
      })
    );
  }
  const categoryIds = {};
  let order = 0;
  for (const key of Object.keys(CATEGORIES)) {
    const c = CATEGORIES[key];
    const row = await tx.financeCategory.create({
      data: {
        portalId,
        kind: c.kind,
        name: c.name,
        accentColor: c.accentColor,
        sortOrder: order++,
        isSystem: c.system
      }
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
        archivedAt: p.status === "ARCHIVED" ? new Date(p.endDate ?? "2025-12-21") : null,
        archivedById: p.status === "ARCHIVED" ? admin.id : null
      }
    });
    for (const idx of p.members) {
      await tx.projectMember.create({
        data: { portalId, projectId: project.id, userId: employees[idx].id, addedById: manager.id }
      });
    }
    await tx.auditLog.create({
      data: {
        portalId,
        actorId: manager.id,
        actorName: "\u0414\u043C\u0438\u0442\u0440\u0438\u0439 \u0421\u043E\u043A\u043E\u043B\u043E\u0432",
        action: "PROJECT_CREATED",
        entityType: "PROJECT",
        entityId: project.id,
        projectId: project.id,
        after: { name: p.name, status: p.status }
      }
    });
    for (const e of p.entries) {
      const isHours = e.hours != null && e.rate != null;
      const amount = isHours ? round2(e.hours, e.rate) : e.amount ?? "0";
      const entry = await tx.financialEntry.create({
        data: {
          portalId,
          projectId: project.id,
          categoryId: categoryIds[e.category],
          direction: e.direction,
          budgetType: e.budget,
          calculationMode: isHours ? "HOURS_RATE" : "FIXED",
          operationDate: new Date(e.date),
          amount,
          hours: e.hours ?? null,
          hourlyRate: e.rate ?? null,
          employeeId: e.employee != null ? employees[e.employee].id : null,
          contractorName: e.contractorName ?? null,
          counterpartyName: e.counterpartyName ?? null,
          invoiceNumber: e.invoiceNumber ?? null,
          description: e.description ?? null,
          createdById: manager.id,
          deletedAt: e.deleted ? new Date(e.date) : null,
          deletedById: e.deleted ? manager.id : null
        }
      });
      await tx.auditLog.create({
        data: {
          portalId,
          actorId: manager.id,
          actorName: "\u0414\u043C\u0438\u0442\u0440\u0438\u0439 \u0421\u043E\u043A\u043E\u043B\u043E\u0432",
          action: e.deleted ? "FINANCE_DELETED" : "FINANCE_CREATED",
          entityType: "FINANCIAL_ENTRY",
          entityId: entry.id,
          projectId: project.id,
          after: { amount, direction: e.direction, budgetType: e.budget }
        }
      });
    }
  }
  return { created: true, portalId };
}

// prisma/seed.ts
var db = new PrismaClient();
async function main() {
  const result = await seedDemoPortal(db);
  if (result.created) {
    console.log(`\u2713 demo portal seeded (${result.portalId})`);
  } else {
    console.log("\u2022 demo portal already present \u2014 nothing to do");
  }
}
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
