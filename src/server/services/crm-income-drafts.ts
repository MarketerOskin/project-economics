import { db } from '@/lib/db/client';
import { withPortal, type PortalScope } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { badRequest } from '@/lib/errors';
import { assertProjectAndCategory } from './finance-write';
import type { ResolvedSession } from '@/lib/auth/resolve';

export interface IncomeDraftDto {
  id: string;
  projectId: string;
  projectName: string;
  crmAmount: string;
  syncedAt: string;
}

function actorName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}

/** PENDING income drafts for review — the CRM deal amount differs from what's recorded. */
export async function listPendingIncomeDrafts(scope: PortalScope): Promise<IncomeDraftDto[]> {
  const drafts = await scope.incomeDraft.findMany({
    where: { status: 'PENDING' },
    include: { project: true },
    orderBy: { syncedAt: 'desc' },
  });

  return drafts.map((d) => ({
    id: d.id,
    projectId: d.projectId,
    projectName: d.project.name,
    crmAmount: d.crmAmount.toString(),
    syncedAt: d.syncedAt.toISOString(),
  }));
}

/**
 * Approve: creates the PLAN/INCOME FinancialEntry the first time, or updates the SAME entry
 * (via resultingEntryId) on a later approval — the deal amount changing isn't a new income
 * line, it's a correction to the one that already represents this project's expected income.
 */
export async function approveIncomeDraft(
  scope: PortalScope,
  session: ResolvedSession,
  draftId: string,
  categoryId: string,
): Promise<{ entryId: string }> {
  const draft = await scope.incomeDraft.findByIdOrThrow(draftId);
  if (draft.status !== 'PENDING') throw badRequest('Этот черновик уже обработан');

  await assertProjectAndCategory(scope, draft.projectId, categoryId, 'INCOME');

  const { portal, user } = session;
  const amount = draft.crmAmount;

  const entryId = await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    let id: string;

    if (draft.resultingEntryId) {
      const updated = await p.entry.update(draft.resultingEntryId, {
        categoryId,
        amount,
        updatedById: user.id,
      });
      id = updated.id;
      await writeAudit(tx, {
        portalId: portal.id,
        actor: { appUserId: user.id, name: actorName(user) },
        action: 'FINANCE_UPDATED',
        entityType: 'FINANCIAL_ENTRY',
        entityId: id,
        projectId: draft.projectId,
        after: { direction: 'INCOME', budgetType: 'PLAN', amount: amount.toString(), source: 'auto-crm-income' },
      });
    } else {
      const created = await p.entry.create({
        projectId: draft.projectId,
        categoryId,
        direction: 'INCOME',
        budgetType: 'PLAN',
        calculationMode: 'FIXED',
        operationDate: new Date(),
        amount,
        description: 'Автоматически по сумме сделки Битрикс24',
        createdById: user.id,
        updatedById: user.id,
      });
      id = created.id;
      await writeAudit(tx, {
        portalId: portal.id,
        actor: { appUserId: user.id, name: actorName(user) },
        action: 'FINANCE_CREATED',
        entityType: 'FINANCIAL_ENTRY',
        entityId: id,
        projectId: draft.projectId,
        after: { direction: 'INCOME', budgetType: 'PLAN', amount: amount.toString(), source: 'auto-crm-income' },
      });
    }

    await p.incomeDraft.update(draft.id, {
      status: 'APPROVED',
      resultingEntryId: id,
      resolvedAt: new Date(),
      resolvedById: user.id,
    });

    return id;
  });

  return { entryId };
}

/** Reject — a later change to the deal amount in Bitrix24 will re-open this for review. */
export async function rejectIncomeDraft(scope: PortalScope, session: ResolvedSession, draftId: string): Promise<void> {
  const draft = await scope.incomeDraft.findByIdOrThrow(draftId);
  if (draft.status !== 'PENDING') throw badRequest('Этот черновик уже обработан');

  await scope.incomeDraft.update(draft.id, {
    status: 'REJECTED',
    resolvedAt: new Date(),
    resolvedById: session.user.id,
  });
}
