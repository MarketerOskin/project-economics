import { db } from '@/lib/db/client';
import { withPortal, type PortalScope } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { badRequest } from '@/lib/errors';
import { hoursRateAmount } from '@/domain/finance';
import { assertProjectAndCategory } from './finance-write';
import type { ResolvedSession } from '@/lib/auth/resolve';

export interface TimeDraftDto {
  id: string;
  projectId: string;
  projectName: string;
  employeeId: string;
  employeeName: string;
  hourlyRate: string | null;
  workDate: string;
  hours: string;
  amount: string | null;
}

function actorName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}

/** PENDING drafts for review, newest first — hours logged automatically from Bitrix24 tasks. */
export async function listPendingDrafts(scope: PortalScope): Promise<TimeDraftDto[]> {
  const drafts = await scope.timeDraft.findMany({
    where: { status: 'PENDING' },
    include: { project: true, employee: true },
    orderBy: { workDate: 'desc' },
  });

  return drafts.map((d) => ({
    id: d.id,
    projectId: d.projectId,
    projectName: d.project.name,
    employeeId: d.employeeId,
    employeeName: actorName(d.employee),
    hourlyRate: d.employee.hourlyRate?.toString() ?? null,
    workDate: d.workDate.toISOString().slice(0, 10),
    hours: d.hours.toString(),
    amount: d.employee.hourlyRate ? hoursRateAmount(d.hours, d.employee.hourlyRate).toString() : null,
  }));
}

/** Approve a draft: creates the real FinancialEntry (HOURS_RATE/EXPENSE/FACT) and resolves it. */
export async function approveTimeDraft(
  scope: PortalScope,
  session: ResolvedSession,
  draftId: string,
  categoryId: string,
): Promise<{ entryId: string }> {
  const draft = await scope.timeDraft.findByIdOrThrow(draftId);
  if (draft.status !== 'PENDING') throw badRequest('Этот черновик уже обработан');

  const employee = await scope.user.findByIdOrThrow(draft.employeeId);
  if (!employee.hourlyRate) {
    throw badRequest(`У сотрудника «${actorName(employee)}» не задана часовая ставка — задайте её в Настройках`);
  }

  await assertProjectAndCategory(scope, draft.projectId, categoryId, 'EXPENSE');

  const hours = draft.hours;
  const rate = employee.hourlyRate;
  const amount = hoursRateAmount(hours, rate);
  const { portal, user } = session;

  const entry = await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const created = await p.entry.create({
      projectId: draft.projectId,
      categoryId,
      direction: 'EXPENSE',
      budgetType: 'FACT',
      calculationMode: 'HOURS_RATE',
      operationDate: draft.workDate,
      amount,
      hours,
      hourlyRate: rate,
      employeeId: employee.id,
      description: `Автоматически по задачам Битрикс24 (${draft.bitrixTaskIds.join(', ')})`,
      createdById: user.id,
      updatedById: user.id,
    });

    await p.timeDraft.update(draft.id, {
      status: 'APPROVED',
      resultingEntryId: created.id,
      resolvedAt: new Date(),
      resolvedById: user.id,
    });

    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: 'FINANCE_CREATED',
      entityType: 'FINANCIAL_ENTRY',
      entityId: created.id,
      projectId: draft.projectId,
      after: { direction: created.direction, budgetType: created.budgetType, amount: created.amount.toString(), source: 'auto-hours' },
    });

    return created;
  });

  return { entryId: entry.id };
}

/** Reject a draft — a future sync may re-propose the same date if time is still logged. */
export async function rejectTimeDraft(scope: PortalScope, session: ResolvedSession, draftId: string): Promise<void> {
  const draft = await scope.timeDraft.findByIdOrThrow(draftId);
  if (draft.status !== 'PENDING') throw badRequest('Этот черновик уже обработан');

  await scope.timeDraft.update(draft.id, {
    status: 'REJECTED',
    resolvedAt: new Date(),
    resolvedById: session.user.id,
  });
}
