import type { PortalScope } from '@/lib/db/with-portal';
import type { ResolvedSession } from '@/lib/auth/resolve';
import { conflict } from '@/lib/errors';
import type { CreateProLeadInput } from '@/server/dto/billing';

export interface ProLeadSummary {
  id: string;
  contact: string;
  comment: string | null;
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'DECLINED';
  createdAt: Date;
}

function actorName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

/** The portal's most recent still-open ("we'll get back to you") lead, if any. */
export async function getOpenProLead(scope: PortalScope): Promise<ProLeadSummary | null> {
  const [lead] = await scope.proLead.findMany({
    where: { status: { in: ['NEW', 'CONTACTED'] } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  return lead ?? null;
}

/**
 * "I want PRO" request from /pricing. One open lead per portal at a time — resubmitting
 * while one is pending is a conflict, not silently ignored, so the user gets clear feedback.
 */
export async function createProLead(
  scope: PortalScope,
  session: ResolvedSession,
  input: CreateProLeadInput,
): Promise<{ id: string }> {
  const existing = await getOpenProLead(scope);
  if (existing) {
    throw conflict('Заявка уже отправлена — мы скоро свяжемся. Дождитесь ответа или напишите нам напрямую.');
  }

  const created = await scope.proLead.create({
    requestedById: session.user.id,
    requestedByName: actorName(session.user),
    contact: input.contact,
    comment: input.comment ?? null,
  });
  return { id: created.id };
}
