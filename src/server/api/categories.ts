import { db } from '@/lib/db/client';
import { withPortal } from '@/lib/db/with-portal';
import { writeAudit } from '@/lib/audit';
import { badRequest, conflict } from '@/lib/errors';
import { can, requirePermission } from '@/lib/permissions';
import { createCategorySchema, updateCategorySchema } from '@/server/dto/category';
import type { HandlerContext } from '@/server/handler';

function actorName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}

export async function createCategory({ req, session, scope }: HandlerContext) {
  requirePermission(can.manageCategories(session.actor));
  const input = createCategorySchema.parse(await req.json());
  const { portal, user } = session;

  const dupe = await scope.category.findMany({ where: { kind: input.kind, name: input.name } });
  if (dupe.length > 0) throw conflict('Статья с таким названием уже есть');

  const maxOrder = await db.financeCategory.aggregate({
    where: { portalId: portal.id, kind: input.kind },
    _max: { sortOrder: true },
  });

  const created = await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    const category = await p.category.create({
      kind: input.kind,
      name: input.name,
      accentColor: input.accentColor,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      createdById: user.id,
    });
    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: 'CATEGORY_CREATED',
      entityType: 'CATEGORY',
      entityId: category.id,
      after: { name: category.name, kind: category.kind },
    });
    return category;
  });

  return Response.json({ id: created.id }, { status: 201 });
}

export async function updateCategory({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.manageCategories(session.actor));
  const existing = await scope.category.findByIdOrThrow(params.id);
  const input = updateCategorySchema.parse(await req.json());
  const { portal, user } = session;

  const archiving = input.isArchived === true && !existing.isArchived;

  await db.$transaction(async (tx) => {
    const p = withPortal(portal.id, tx);
    await p.category.update(existing.id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.accentColor !== undefined && { accentColor: input.accentColor }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
      updatedById: user.id,
    });
    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: archiving ? 'CATEGORY_ARCHIVED' : 'CATEGORY_UPDATED',
      entityType: 'CATEGORY',
      entityId: existing.id,
      before: { name: existing.name, accentColor: existing.accentColor, isArchived: existing.isArchived },
      after: {
        name: input.name ?? existing.name,
        accentColor: input.accentColor ?? existing.accentColor,
        isArchived: input.isArchived ?? existing.isArchived,
      },
    });
  });

  return { ok: true };
}

export async function deleteCategory({ params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.manageCategories(session.actor));
  const existing = await scope.category.findByIdOrThrow(params.id);

  const usage = await scope.entry.count({ categoryId: existing.id });
  if (usage > 0) {
    throw badRequest('Статья используется в операциях — её можно только архивировать');
  }

  const { portal, user } = session;
  await db.$transaction(async (tx) => {
    await tx.financeCategory.delete({ where: { id: existing.id } });
    await writeAudit(tx, {
      portalId: portal.id,
      actor: { appUserId: user.id, name: actorName(user) },
      action: 'CATEGORY_UPDATED',
      entityType: 'CATEGORY',
      entityId: existing.id,
      before: { name: existing.name, kind: existing.kind },
      after: { deleted: true },
    });
  });

  return { ok: true };
}
