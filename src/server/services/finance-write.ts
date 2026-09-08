import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withPortal, type PortalScope } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { badRequest } from '@/lib/errors';
import { hoursRateAmount, m } from '@/domain/finance';
import type { ResolvedSession } from '@/lib/auth/resolve';
import type { CreateEntryInput, UpdateEntryInput } from '@/server/dto/finance';

function actorName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}

/** Resolve the authoritative amount + hours/rate snapshot (ТЗ §14 — never trust the client). */
function resolveAmount(input: {
  calculationMode: 'FIXED' | 'HOURS_RATE';
  amount?: string;
  hours?: string;
  hourlyRate?: string;
}): { amount: Prisma.Decimal; hours: Prisma.Decimal | null; hourlyRate: Prisma.Decimal | null } {
  if (input.calculationMode === 'HOURS_RATE') {
    const hours = m(input.hours!);
    const rate = m(input.hourlyRate!);
    return { amount: hoursRateAmount(hours, rate), hours, hourlyRate: rate };
  }
  return { amount: m(input.amount!), hours: null, hourlyRate: null };
}

async function assertProjectAndCategory(
  scope: PortalScope,
  projectId: string,
  categoryId: string,
  direction: 'INCOME' | 'EXPENSE',
) {
  await scope.project.findByIdOrThrow(projectId);
  const category = await scope.category.findByIdOrThrow(categoryId);
  if (category.kind !== direction) {
    throw badRequest(
      direction === 'INCOME'
        ? 'Выбрана статья расхода для дохода'
        : 'Выбрана статья дохода для расхода',
    );
  }
  if (category.isArchived) {
    throw badRequest('Статья архивирована — выберите другую');
  }
}

export async function createEntry(
  scope: PortalScope,
  session: ResolvedSession,
  input: CreateEntryInput,
): Promise<{ id: string }> {
  await assertProjectAndCategory(scope, input.projectId, input.categoryId, input.direction);
  if (input.employeeId) await scope.user.findByIdOrThrow(input.employeeId);

  const { amount, hours, hourlyRate } = resolveAmount(input);
  const { portal, user } = session;

  const created = await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const entry = await p.entry.create({
      projectId: input.projectId,
      categoryId: input.categoryId,
      direction: input.direction,
      budgetType: input.budgetType,
      calculationMode: input.calculationMode,
      operationDate: input.operationDate,
      amount,
      hours,
      hourlyRate,
      employeeId: input.employeeId ?? null,
      contractorName: input.contractorName ?? null,
      counterpartyName: input.counterpartyName ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      invoiceDate: input.invoiceDate ?? null,
      documentUrl: input.documentUrl ?? null,
      description: input.description ?? null,
      comment: input.comment ?? null,
      plannedEntryId: input.plannedEntryId ?? null,
      createdById: user.id,
      updatedById: user.id,
    });

    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: 'FINANCE_CREATED',
      entityType: 'FINANCIAL_ENTRY',
      entityId: entry.id,
      projectId: input.projectId,
      after: {
        direction: entry.direction,
        budgetType: entry.budgetType,
        amount: entry.amount.toString(),
        categoryId: entry.categoryId,
      },
    });

    return entry;
  });

  return { id: created.id };
}

export async function updateEntry(
  scope: PortalScope,
  session: ResolvedSession,
  id: string,
  input: UpdateEntryInput,
): Promise<void> {
  const existing = await scope.entry.findByIdOrThrow(id);
  if (existing.deletedAt) throw badRequest('Операция удалена');
  const { portal, user } = session;

  const direction = input.direction ?? existing.direction;
  const categoryId = input.categoryId ?? existing.categoryId;
  if (input.categoryId || input.direction) {
    await assertProjectAndCategory(scope, input.projectId ?? existing.projectId, categoryId, direction);
  }
  if (input.employeeId) await scope.user.findByIdOrThrow(input.employeeId);

  const mode = input.calculationMode ?? existing.calculationMode;
  let amount = existing.amount;
  let hours = existing.hours;
  let hourlyRate = existing.hourlyRate;
  if (input.calculationMode || input.amount || input.hours || input.hourlyRate) {
    const resolved = resolveAmount({
      calculationMode: mode,
      amount: input.amount ?? existing.amount.toString(),
      hours: input.hours ?? existing.hours?.toString(),
      hourlyRate: input.hourlyRate ?? existing.hourlyRate?.toString(),
    });
    amount = resolved.amount;
    hours = resolved.hours;
    hourlyRate = resolved.hourlyRate;
  }

  const data: Prisma.FinancialEntryUncheckedUpdateInput = {
    updatedById: user.id,
    calculationMode: mode,
    amount,
    hours,
    hourlyRate,
  };
  if (input.projectId) data.projectId = input.projectId;
  if (input.categoryId) data.categoryId = input.categoryId;
  if (input.direction) data.direction = input.direction;
  if (input.budgetType) data.budgetType = input.budgetType;
  if (input.operationDate) data.operationDate = input.operationDate;
  if (input.employeeId !== undefined) data.employeeId = input.employeeId ?? null;
  for (const k of ['contractorName', 'counterpartyName', 'invoiceNumber', 'description', 'comment', 'documentUrl'] as const) {
    if (input[k] !== undefined) data[k] = input[k] ?? null;
  }
  if (input.invoiceDate !== undefined) data.invoiceDate = input.invoiceDate ?? null;

  await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const updated = await p.entry.update(existing.id, data);
    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: 'FINANCE_UPDATED',
      entityType: 'FINANCIAL_ENTRY',
      entityId: existing.id,
      projectId: updated.projectId,
      before: { amount: existing.amount.toString(), direction: existing.direction, budgetType: existing.budgetType, categoryId: existing.categoryId },
      after: { amount: updated.amount.toString(), direction: updated.direction, budgetType: updated.budgetType, categoryId: updated.categoryId },
    });
  });
}

export async function softDeleteEntry(
  scope: PortalScope,
  session: ResolvedSession,
  id: string,
): Promise<void> {
  const existing = await scope.entry.findByIdOrThrow(id);
  if (existing.deletedAt) return;
  const { portal, user } = session;

  await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    await p.entry.update(existing.id, { deletedAt: new Date(), deletedById: user.id });
    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: 'FINANCE_DELETED',
      entityType: 'FINANCIAL_ENTRY',
      entityId: existing.id,
      projectId: existing.projectId,
      before: { amount: existing.amount.toString(), direction: existing.direction, budgetType: existing.budgetType },
    });
  });
}
