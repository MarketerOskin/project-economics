import { Prisma } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import type { Actor } from '@/lib/permissions';
import { can, requirePermission } from '@/lib/permissions';
import type { ListEntriesQuery } from '@/server/dto/finance';

export interface EntryRow {
  id: string;
  projectId: string;
  projectName: string;
  direction: 'INCOME' | 'EXPENSE';
  budgetType: 'PLAN' | 'FACT';
  calculationMode: 'FIXED' | 'HOURS_RATE';
  operationDate: Date;
  amount: string;
  hours: string | null;
  hourlyRate: string | null;
  category: { id: string; name: string; accentColor: string };
  employeeId: string | null;
  employee: string | null;
  contractorName: string | null;
  counterpartyName: string | null;
  description: string | null;
  comment: string | null;
  invoiceNumber: string | null;
  documentUrl: string | null;
  author: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

const include = {
  project: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, accentColor: true } },
  employee: { select: { firstName: true, lastName: true } },
  createdBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.FinancialEntryInclude;

type Loaded = Prisma.FinancialEntryGetPayload<{ include: typeof include }>;

function toRow(e: Loaded): EntryRow {
  return {
    id: e.id,
    projectId: e.projectId,
    projectName: e.project.name,
    direction: e.direction,
    budgetType: e.budgetType,
    calculationMode: e.calculationMode,
    operationDate: e.operationDate,
    amount: e.amount.toString(),
    hours: e.hours?.toString() ?? null,
    hourlyRate: e.hourlyRate?.toString() ?? null,
    category: e.category,
    employeeId: e.employeeId,
    employee: e.employee ? `${e.employee.firstName} ${e.employee.lastName}`.trim() : null,
    contractorName: e.contractorName,
    counterpartyName: e.counterpartyName,
    description: e.description,
    comment: e.comment,
    invoiceNumber: e.invoiceNumber,
    documentUrl: e.documentUrl,
    author: e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}`.trim() : null,
    createdAt: e.createdAt,
    deletedAt: e.deletedAt,
  };
}

export interface EntryPage {
  rows: EntryRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Ledger query with backend filter / sort / pagination (ТЗ §27). EMPLOYEE is limited to
 * entries of projects they are a member of. Deleted rows are hidden unless the caller is
 * MANAGER/ADMIN and asks for them.
 */
export async function queryEntries(
  scope: PortalScope,
  actor: Actor,
  q: ListEntriesQuery,
): Promise<EntryPage> {
  const where: Prisma.FinancialEntryWhereInput = {};

  if (q.projectId) where.projectId = q.projectId;
  if (q.direction) where.direction = q.direction;
  if (q.budgetType) where.budgetType = q.budgetType;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.employeeId) where.employeeId = q.employeeId;
  if (q.authorId) where.createdById = q.authorId;
  if (q.from || q.to) {
    where.operationDate = { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) };
  }
  if (q.q) {
    where.OR = [
      { description: { contains: q.q, mode: 'insensitive' } },
      { comment: { contains: q.q, mode: 'insensitive' } },
      { contractorName: { contains: q.q, mode: 'insensitive' } },
      { counterpartyName: { contains: q.q, mode: 'insensitive' } },
    ];
  }

  const includeDeleted = q.includeDeleted && can.viewAllProjects(actor);
  if (!includeDeleted) where.deletedAt = null;

  if (!can.viewAllProjects(actor)) {
    where.project = { members: { some: { userId: actor.appUserId } } };
  }

  const orderBy: Prisma.FinancialEntryOrderByWithRelationInput =
    q.sort === 'amount'
      ? { amount: q.dir }
      : q.sort === 'project'
        ? { project: { name: q.dir } }
        : { operationDate: q.dir };

  const [rows, total] = await Promise.all([
    scope.entry.findMany({
      where,
      include,
      orderBy: [orderBy, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    scope.entry.count(where),
  ]);

  return { rows: rows.map(toRow), total, page: q.page, pageSize: q.pageSize };
}

/** Assert the actor may see a given project's finances (used by the project finance tab). */
export async function assertCanViewProjectFinance(
  scope: PortalScope,
  actor: Actor,
  projectId: string,
): Promise<void> {
  const project = await scope.project.findByIdOrThrow(projectId, {
    include: { members: { select: { userId: true } } },
  });
  requirePermission(can.viewProject(actor, { memberUserIds: project.members.map((m) => m.userId) }));
}
