import { Prisma } from '@prisma/client';
import type { AuditAction, AuditEntityType, PrismaClient } from '@prisma/client';

type AuditClient = Pick<PrismaClient, 'auditLog'>;

export interface WriteAuditInput {
  portalId: string;
  actor: { appUserId: string; name: string };
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  projectId?: string | null;
  before?: Prisma.JsonValue | null;
  after?: Prisma.JsonValue | null;
}

/** Fields whose value differs between `before` and `after` (shallow). */
function diffFields(
  before: Prisma.JsonValue | null | undefined,
  after: Prisma.JsonValue | null | undefined,
): string[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  if (Array.isArray(before) || Array.isArray(after)) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of keys) {
    const a = (before as Record<string, unknown>)[k];
    const b = (after as Record<string, unknown>)[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(k);
  }
  return changed;
}

/**
 * Append an audit row. MUST be called inside the same `prisma.$transaction` as the mutation
 * it records, so "the entry changed but the audit didn't" is impossible (ТЗ §30, §52).
 */
export async function writeAudit(client: AuditClient, input: WriteAuditInput) {
  return client.auditLog.create({
    data: {
      portalId: input.portalId,
      actorId: input.actor.appUserId,
      actorName: input.actor.name,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId ?? null,
      before: input.before ?? Prisma.JsonNull,
      after: input.after ?? Prisma.JsonNull,
      changedFields: diffFields(input.before, input.after),
    },
  });
}

export { diffFields as _diffFieldsForTest };
