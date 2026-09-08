import { Prisma } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import type { Actor } from '@/lib/permissions';
import { can, requirePermission } from '@/lib/permissions';
import { humanizeAudit, type HumanAuditEntry } from '@/lib/audit/humanize';

export interface AuditQuery {
  from?: Date;
  to?: Date;
  actorId?: string;
  projectId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditPage {
  entries: HumanAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * History feed (ТЗ §32). The global `/history` is ADMIN/MANAGER only. When `projectId` is
 * given the caller must be able to view that project (member EMPLOYEE included).
 */
export async function queryAudit(
  scope: PortalScope,
  actor: Actor,
  q: AuditQuery,
): Promise<AuditPage> {
  if (q.projectId) {
    const project = await scope.project.findByIdOrThrow(q.projectId, {
      include: { members: { select: { userId: true } } },
    });
    requirePermission(can.viewProject(actor, { memberUserIds: project.members.map((m) => m.userId) }));
  } else {
    requirePermission(can.viewHistory(actor));
  }

  const page = q.page ?? 1;
  const pageSize = Math.min(q.pageSize ?? 30, 100);

  const where: Prisma.AuditLogWhereInput = {};
  if (q.projectId) where.projectId = q.projectId;
  if (q.actorId) where.actorId = q.actorId;
  if (q.action) where.action = q.action as Prisma.AuditLogWhereInput['action'];
  if (q.from || q.to) {
    where.createdAt = { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) };
  }

  const [rows, total] = await Promise.all([
    scope.audit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    scope.audit.count(where),
  ]);

  // Resolve project names in one query.
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter((v): v is string => Boolean(v)))];
  const projects =
    projectIds.length > 0
      ? await scope.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } })
      : [];
  const nameById = new Map(projects.map((p) => [p.id, p.name]));

  return {
    entries: rows.map((r) => humanizeAudit(r, r.projectId ? nameById.get(r.projectId) : undefined)),
    total,
    page,
    pageSize,
  };
}
