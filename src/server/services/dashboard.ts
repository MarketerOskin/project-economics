import { Prisma } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import type { Actor } from '@/lib/permissions';
import { can } from '@/lib/permissions';
import {
  aggregateCompany,
  aggregateProject,
  expenseStructure,
  timeSeries,
  type EntryInput,
} from '@/domain/finance';
import { economicsToJson, type EconomicsJson } from '@/server/serialize';
import { granularityFor } from '@/lib/period';
import { colorHex } from '@/lib/categories/palette';

export interface DashboardQuery {
  from?: Date;
  to?: Date;
  projectId?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'ALL';
  employeeId?: string;
  categoryId?: string;
}

export interface DashboardData {
  kpi: EconomicsJson;
  timeseries: {
    bucket: string;
    factIncome: string;
    factExpense: string;
    planIncome: string;
    planExpense: string;
  }[];
  projectBars: { id: string; name: string; profit: string; margin: string | null }[];
  expenseStructure: { categoryId: string; name: string; color: string; amount: string }[];
  projects: {
    id: string;
    name: string;
    status: string;
    economics: EconomicsJson;
  }[];
}

/**
 * Everything the dashboard needs, from ONE entry query + one project query (ТЗ §53).
 * Every number is scoped to what the actor may see (EMPLOYEE -> member projects only, ТЗ §7).
 */
export async function loadDashboard(
  scope: PortalScope,
  actor: Actor,
  q: DashboardQuery,
): Promise<DashboardData> {
  const projectWhere: Prisma.ProjectWhereInput = {};
  if (q.projectId) projectWhere.id = q.projectId;
  if (q.status && q.status !== 'ALL') projectWhere.status = q.status;
  else if (!q.status) projectWhere.status = { not: 'ARCHIVED' };
  if (!can.viewAllProjects(actor)) {
    projectWhere.members = { some: { userId: actor.appUserId } };
  }

  const projects = await scope.project.findMany({
    where: projectWhere,
    select: { id: true, name: true, status: true },
    orderBy: { name: 'asc' },
  });
  const projectIds = projects.map((p) => p.id);

  const entryWhere: Prisma.FinancialEntryWhereInput = {
    projectId: { in: projectIds },
    deletedAt: null,
  };
  if (q.from || q.to) {
    entryWhere.operationDate = { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) };
  }
  if (q.employeeId) entryWhere.employeeId = q.employeeId;
  if (q.categoryId) entryWhere.categoryId = q.categoryId;

  const rows = await scope.entry.findMany({
    where: entryWhere,
    select: {
      projectId: true,
      direction: true,
      budgetType: true,
      amount: true,
      categoryId: true,
      operationDate: true,
      deletedAt: true,
    },
  });

  const byProject = new Map<string, EntryInput[]>();
  for (const id of projectIds) byProject.set(id, []);
  const asInput = (r: (typeof rows)[number]): EntryInput => ({
    direction: r.direction,
    budgetType: r.budgetType,
    amount: r.amount,
    categoryId: r.categoryId,
    operationDate: r.operationDate,
    deletedAt: r.deletedAt,
  });
  for (const r of rows) byProject.get(r.projectId)?.push(asInput(r));

  const perProject = projects.map((p) => ({
    project: p,
    economics: aggregateProject(byProject.get(p.id) ?? []),
  }));
  const company = aggregateCompany(perProject.map((p) => p.economics));

  // Expense structure — categories present in the data, resolved to names + colors.
  const allInputs = rows.map(asInput);
  const structure = expenseStructure(allInputs, 'FACT');
  const categoryIds = structure.map((s) => s.categoryId);
  const categories =
    categoryIds.length > 0
      ? await scope.category.findMany({ where: { id: { in: categoryIds } } })
      : [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const gran = granularityFor(q.from, q.to);
  const seriesFrom = q.from ?? rows.reduce<Date | undefined>((min, r) => (!min || r.operationDate < min ? r.operationDate : min), undefined) ?? new Date();
  const seriesTo = q.to ?? new Date();
  const series = timeSeries(allInputs, { from: seriesFrom, to: seriesTo, granularity: gran });

  return {
    kpi: economicsToJson(company),
    timeseries: series.map((s) => ({
      bucket: s.bucket,
      factIncome: s.factIncome.toString(),
      factExpense: s.factExpense.toString(),
      planIncome: s.planIncome.toString(),
      planExpense: s.planExpense.toString(),
    })),
    projectBars: perProject
      .map((p) => ({
        id: p.project.id,
        name: p.project.name,
        profit: p.economics.factProfit.toString(),
        margin: p.economics.factMargin?.toString() ?? null,
      }))
      .sort((a, b) => Number(b.profit) - Number(a.profit)),
    expenseStructure: structure.map((s) => ({
      categoryId: s.categoryId,
      name: catMap.get(s.categoryId)?.name ?? 'Другое',
      color: colorHex(catMap.get(s.categoryId)?.accentColor ?? 'blue'),
      amount: s.amount.toString(),
    })),
    projects: perProject.map((p) => ({
      id: p.project.id,
      name: p.project.name,
      status: p.project.status,
      economics: economicsToJson(p.economics),
    })),
  };
}
