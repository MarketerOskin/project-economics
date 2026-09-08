import { can, requirePermission } from '@/lib/permissions';
import { createEntrySchema, listEntriesQuerySchema, updateEntrySchema } from '@/server/dto/finance';
import { createEntry, softDeleteEntry, updateEntry } from '@/server/services/finance-write';
import { queryEntries } from '@/server/services/finance-read';
import type { HandlerContext } from '@/server/handler';

export async function listEntries({ req, session, scope }: HandlerContext) {
  const q = listEntriesQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return queryEntries(scope, session.actor, q);
}

export async function postEntry({ req, session, scope }: HandlerContext) {
  requirePermission(can.mutateFinance(session.actor));
  const input = createEntrySchema.parse(await req.json());
  const created = await createEntry(scope, session, input);
  return Response.json(created, { status: 201 });
}

export async function patchEntry({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateFinance(session.actor));
  const input = updateEntrySchema.parse(await req.json());
  await updateEntry(scope, session, params.id, input);
  return { ok: true };
}

export async function deleteEntry({ params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateFinance(session.actor));
  await softDeleteEntry(scope, session, params.id);
  return { ok: true };
}
