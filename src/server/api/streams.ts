import { can, requirePermission } from '@/lib/permissions';
import { streamSchema } from '@/server/dto/stream';
import {
  archiveStream,
  createStream,
  projectStreams,
  updateStream,
} from '@/server/services/streams';
import type { HandlerContext } from '@/server/handler';

/** GET /api/projects/:id/streams — the project's directions (ADR-052). */
export async function listStreams({ params, session, scope }: HandlerContext<{ id: string }>) {
  const project = await scope.project.findByIdOrThrow(params.id, { include: { members: true } });
  requirePermission(
    can.viewProject(session.actor, { memberUserIds: project.members.map((m) => m.userId) }),
  );
  return projectStreams(scope, params.id);
}

export async function postStream({ req, params, session, scope }: HandlerContext<{ id: string }>) {
  requirePermission(can.mutateProject(session.actor));
  const input = streamSchema.parse(await req.json());
  return Response.json(await createStream(session, scope, params.id, input), { status: 201 });
}

export async function patchStream({
  req,
  params,
  session,
  scope,
}: HandlerContext<{ id: string; streamId: string }>) {
  requirePermission(can.mutateProject(session.actor));
  const input = streamSchema.parse(await req.json());
  return updateStream(session, scope, params.id, params.streamId, input);
}

export async function deleteStream({
  params,
  session,
  scope,
}: HandlerContext<{ id: string; streamId: string }>) {
  requirePermission(can.mutateProject(session.actor));
  await archiveStream(session, scope, params.id, params.streamId);
  return { ok: true };
}
