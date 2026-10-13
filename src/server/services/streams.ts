import type { ProjectStream } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withPortal, type PortalScope } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { badRequest } from '@/lib/errors';
import { aggregateProject } from '@/domain/finance/aggregates';
import type { ResolvedSession } from '@/lib/auth/resolve';
import { economicsToJson, type EconomicsJson } from '@/server/serialize';
import type { StreamInput } from '@/server/dto/stream';

/**
 * Project directions (ADR-052): support, implementation, development… of one client project,
 * each with its own payment terms and team. Operations can be tagged with a direction, so each
 * direction has its own income, expense and profit.
 */

export interface StreamDto {
  id: string;
  kind: ProjectStream['kind'];
  name: string | null;
  status: ProjectStream['status'];
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  monthlyFee: string | null;
  hourRate: string | null;
  hoursLimit: string | null;
  memberIds: string[];
  comment: string | null;
}

const dateKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dec = (v: { toString(): string } | null) => (v === null ? null : v.toString());

export function streamDto(s: ProjectStream): StreamDto {
  return {
    id: s.id,
    kind: s.kind,
    name: s.name,
    status: s.status,
    startDate: dateKey(s.startDate),
    endDate: dateKey(s.endDate),
    budget: dec(s.budget),
    monthlyFee: dec(s.monthlyFee),
    hourRate: dec(s.hourRate),
    hoursLimit: dec(s.hoursLimit),
    memberIds: s.memberIds,
    comment: s.comment,
  };
}

/** A project's directions with each one's fact and plan economics; `null` key = untagged. */
export async function projectStreams(
  scope: PortalScope,
  projectId: string,
): Promise<{
  streams: Array<StreamDto & { economics: EconomicsJson }>;
  untagged: EconomicsJson | null;
}> {
  const [streams, entries] = await Promise.all([
    scope.stream.findMany({ projectId }),
    scope.entry.findMany({
      where: { projectId },
      select: {
        streamId: true,
        direction: true,
        budgetType: true,
        amount: true,
        categoryId: true,
        operationDate: true,
        deletedAt: true,
      },
    }),
  ]);
  const by = new Map<string | null, typeof entries>();
  for (const e of entries) {
    const k = e.streamId && streams.some((s) => s.id === e.streamId) ? e.streamId : null;
    by.set(k, [...(by.get(k) ?? []), e]);
  }
  return {
    streams: streams.map((s) => ({
      ...streamDto(s),
      economics: economicsToJson(aggregateProject(by.get(s.id) ?? [])),
    })),
    untagged:
      streams.length && by.get(null)?.length
        ? economicsToJson(aggregateProject(by.get(null)!))
        : null,
  };
}

function data(input: StreamInput) {
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw badRequest('Дата окончания раньше даты начала');
  }
  return {
    kind: input.kind,
    name: input.name,
    status: input.status,
    startDate: input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : null,
    endDate: input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null,
    budget: input.budget,
    monthlyFee: input.monthlyFee,
    hourRate: input.hourRate,
    hoursLimit: input.hoursLimit,
    memberIds: [...new Set(input.memberIds)],
    comment: input.comment,
  };
}

/** Team members must be people of this portal. */
async function checkMembers(scope: PortalScope, ids: string[]) {
  if (!ids.length) return;
  const found = await scope.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (found.length !== new Set(ids).size)
    throw badRequest('В команде есть сотрудник не из этого портала');
}

const actorOf = (session: ResolvedSession) => ({
  appUserId: session.user.id,
  name: `${session.user.firstName} ${session.user.lastName}`.trim(),
});

export async function createStream(
  session: ResolvedSession,
  scope: PortalScope,
  projectId: string,
  input: StreamInput,
) {
  await scope.project.findByIdOrThrow(projectId);
  await checkMembers(scope, input.memberIds);
  return db.$transaction(async (tx) => {
    const s = await withPortal(session.portal.id, tx).stream.create({ ...data(input), projectId });
    await writeAudit(tx, {
      portalId: session.portal.id,
      actor: actorOf(session),
      action: 'PROJECT_UPDATED',
      entityType: 'PROJECT_STREAM',
      entityId: s.id,
      projectId,
      before: null,
      after: { ...streamDto(s) },
    });
    return streamDto(s);
  });
}

export async function updateStream(
  session: ResolvedSession,
  scope: PortalScope,
  projectId: string,
  id: string,
  input: StreamInput,
) {
  const existing = await scope.stream.findByIdOrThrow(id);
  if (existing.projectId !== projectId) throw badRequest('Направление другого проекта');
  await checkMembers(scope, input.memberIds);
  return db.$transaction(async (tx) => {
    const s = await withPortal(session.portal.id, tx).stream.update(id, data(input));
    await writeAudit(tx, {
      portalId: session.portal.id,
      actor: actorOf(session),
      action: 'PROJECT_UPDATED',
      entityType: 'PROJECT_STREAM',
      entityId: id,
      projectId,
      before: { ...streamDto(existing) },
      after: { ...streamDto(s) },
    });
    return streamDto(s);
  });
}

/** Archives a direction; its operations stay and count for the project as a whole. */
export async function archiveStream(
  session: ResolvedSession,
  scope: PortalScope,
  projectId: string,
  id: string,
) {
  const existing = await scope.stream.findByIdOrThrow(id);
  if (existing.projectId !== projectId) throw badRequest('Направление другого проекта');
  await db.$transaction(async (tx) => {
    await withPortal(session.portal.id, tx).stream.update(id, { archivedAt: new Date() });
    await writeAudit(tx, {
      portalId: session.portal.id,
      actor: actorOf(session),
      action: 'PROJECT_UPDATED',
      entityType: 'PROJECT_STREAM',
      entityId: id,
      projectId,
      before: { ...streamDto(existing) },
      after: null,
    });
  });
}
