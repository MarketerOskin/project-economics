import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withPortal } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { badRequest } from '@/lib/errors';
import { can, requirePermission } from '@/lib/permissions';
import { createProjectSchema, listProjectsQuerySchema, setMembersSchema, updateProjectSchema } from '@/server/dto/project';
import { getProjectDetail, queryProjects } from '@/server/services/project-read';
import type { HandlerContext } from '@/server/handler';

function actorName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

// ─── GET /api/projects ──────────────────────────────────────────────────────

export async function listProjects({ req, session, scope }: HandlerContext) {
  const q = listProjectsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return { projects: await queryProjects(scope, session.actor, q) };
}

// ─── GET /api/projects/:id ──────────────────────────────────────────────────

export async function getProject({ params, session, scope }: HandlerContext<{ id: string }>) {
  return getProjectDetail(scope, session.actor, params.id);
}

// ─── POST /api/projects ─────────────────────────────────────────────────────

export async function createProject({ req, session, scope }: HandlerContext) {
  requirePermission(can.mutateProject(session.actor));
  const input = createProjectSchema.parse(await req.json());
  const { portal, user } = session;

  if (input.memberIds.length > 0) {
    const found = await scope.user.listByIds(input.memberIds);
    if (found.length !== new Set(input.memberIds).size) {
      throw badRequest('Некоторые выбранные сотрудники не найдены в портале');
    }
  }

  const created = await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const project = await p.project.create({
      name: input.name,
      description: input.description,
      clientName: input.clientName,
      internalComment: input.internalComment,
      status: input.status,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      sourceType: input.source,
      crmEntityTypeId: input.crmEntityTypeId ?? null,
      crmEntityId: input.crmEntityId ?? null,
      createdById: user.id,
      updatedById: user.id,
    });

    if (input.memberIds.length > 0) {
      await p.member.createMany(
        input.memberIds.map((userId) => ({ projectId: project.id, userId, addedById: user.id })),
      );
    }

    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: 'PROJECT_CREATED',
      entityType: 'PROJECT',
      entityId: project.id,
      projectId: project.id,
      after: { name: project.name, status: project.status, memberIds: input.memberIds },
    });

    return project;
  });

  return Response.json({ id: created.id }, { status: 201 });
}

// ─── PATCH /api/projects/:id ────────────────────────────────────────────────

export async function updateProject({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateProject(session.actor));
  const existing = await scope.project.findByIdOrThrow(params.id);
  const input = updateProjectSchema.parse(await req.json());
  const { portal, user } = session;

  const data: Prisma.ProjectUncheckedUpdateInput = { updatedById: user.id };
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description ?? null;
  if (input.clientName !== undefined) data.clientName = input.clientName ?? null;
  if (input.internalComment !== undefined) data.internalComment = input.internalComment ?? null;
  if (input.status !== undefined) data.status = input.status;
  if (input.startDate !== undefined) data.startDate = input.startDate;
  if (input.endDate !== undefined) data.endDate = input.endDate;

  const before = {
    name: existing.name,
    description: existing.description,
    clientName: existing.clientName,
    internalComment: existing.internalComment,
    status: existing.status,
    startDate: existing.startDate?.toISOString() ?? null,
    endDate: existing.endDate?.toISOString() ?? null,
  };

  await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const updated = await p.project.update(existing.id, data);
    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: 'PROJECT_UPDATED',
      entityType: 'PROJECT',
      entityId: existing.id,
      projectId: existing.id,
      before,
      after: {
        name: updated.name,
        description: updated.description,
        clientName: updated.clientName,
        internalComment: updated.internalComment,
        status: updated.status,
        startDate: updated.startDate?.toISOString() ?? null,
        endDate: updated.endDate?.toISOString() ?? null,
      },
    });
  });

  return { ok: true };
}

// ─── POST /api/projects/:id/archive ─────────────────────────────────────────

export async function archiveProject({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.archiveProject(session.actor));
  const existing = await scope.project.findByIdOrThrow(params.id);
  const body = (await req.json().catch(() => ({}))) as { archived?: boolean };
  const archived = body.archived ?? true;
  const { portal, user } = session;

  if (archived && existing.status === 'ARCHIVED') return { ok: true };
  if (!archived && existing.status !== 'ARCHIVED') return { ok: true };

  await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    await p.project.update(existing.id, {
      status: archived ? 'ARCHIVED' : 'ACTIVE',
      archivedAt: archived ? new Date() : null,
      archivedById: archived ? user.id : null,
      updatedById: user.id,
    });
    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: archived ? 'PROJECT_ARCHIVED' : 'PROJECT_RESTORED',
      entityType: 'PROJECT',
      entityId: existing.id,
      projectId: existing.id,
      before: { status: existing.status },
      after: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
    });
  });

  return { ok: true };
}

// ─── PUT /api/projects/:id/members ──────────────────────────────────────────

export async function setProjectMembers({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.manageMembers(session.actor));
  const project = await scope.project.findByIdOrThrow(params.id, {
    include: { members: true },
  });
  const { userIds } = setMembersSchema.parse(await req.json());
  const { portal, user } = session;

  const unique = [...new Set(userIds)];
  if (unique.length > 0) {
    const found = await scope.user.listByIds(unique);
    if (found.length !== unique.length) {
      throw badRequest('Некоторые выбранные сотрудники не найдены в портале');
    }
  }

  const current = new Set(project.members.map((m) => m.userId));
  const next = new Set(unique);
  const toAdd = unique.filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !next.has(id));
  if (toAdd.length === 0 && toRemove.length === 0) return { ok: true };

  await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    if (toRemove.length > 0) {
      await p.member.deleteMany({ projectId: project.id, userId: { in: toRemove } });
    }
    if (toAdd.length > 0) {
      await p.member.createMany(
        toAdd.map((userId) => ({ projectId: project.id, userId, addedById: user.id })),
      );
    }
    for (const userId of toAdd) {
      await writeAudit(tx, {
        portalId: portal.id,
        actor: { appUserId: user.id, name: actorName(user) },
        action: 'PROJECT_MEMBER_ADDED',
        entityType: 'PROJECT_MEMBER',
        entityId: `${project.id}:${userId}`,
        projectId: project.id,
        after: { userId },
      });
    }
    for (const userId of toRemove) {
      await writeAudit(tx, {
        portalId: portal.id,
        actor: { appUserId: user.id, name: actorName(user) },
        action: 'PROJECT_MEMBER_REMOVED',
        entityType: 'PROJECT_MEMBER',
        entityId: `${project.id}:${userId}`,
        projectId: project.id,
        before: { userId },
      });
    }
  });

  return { ok: true };
}
