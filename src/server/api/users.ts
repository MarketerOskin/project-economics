import { can, requirePermission } from '@/lib/permissions';
import { updateUserSchema } from '@/server/dto/user';
import type { HandlerContext } from '@/server/handler';

/** Admin sets an employee's hourly rate — used by the automated-hours sync (ADR-027). */
export async function patchUser({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.manageSettings(session.actor));
  const existing = await scope.user.findByIdOrThrow(params.id);
  const { hourlyRate } = updateUserSchema.parse(await req.json());

  await scope.user.update(existing.id, { hourlyRate });
  return { ok: true };
}
