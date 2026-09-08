import type { PortalScope } from '@/lib/db/with-portal';
import { aggregateProject, type EntryInput, type ProjectEconomics } from '@/domain/finance';

export interface EconomicsPeriod {
  from?: Date;
  to?: Date;
}

/**
 * Load plan/fact economics for many projects in ONE query (no N+1 — ТЗ §53).
 * Deleted rows are fetched too and filtered inside the engine (single choke point).
 */
export async function loadProjectEconomics(
  scope: PortalScope,
  projectIds: string[],
  period: EconomicsPeriod = {},
): Promise<Map<string, ProjectEconomics>> {
  const result = new Map<string, ProjectEconomics>();
  if (projectIds.length === 0) return result;

  const rows = await scope.entry.findMany({
    where: {
      projectId: { in: projectIds },
      ...(period.from || period.to
        ? { operationDate: { ...(period.from && { gte: period.from }), ...(period.to && { lte: period.to }) } }
        : {}),
    },
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
  for (const r of rows) {
    byProject.get(r.projectId)?.push({
      direction: r.direction,
      budgetType: r.budgetType,
      amount: r.amount,
      categoryId: r.categoryId,
      operationDate: r.operationDate,
      deletedAt: r.deletedAt,
    });
  }

  for (const [id, entries] of byProject) {
    result.set(id, aggregateProject(entries));
  }
  return result;
}
