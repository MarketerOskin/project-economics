import { route } from '@/server/handler';
import { createProLeadSchema } from '@/server/dto/billing';
import { createProLead, getOpenProLead } from '@/server/services/billing';

export const dynamic = 'force-dynamic';

/** Whether this portal already has an open ("we'll get back to you") PRO request. */
export const GET = route(async ({ scope }) => {
  const lead = await getOpenProLead(scope);
  return { pending: Boolean(lead), lead };
});

export const POST = route(async ({ req, session, scope }) => {
  const input = createProLeadSchema.parse(await req.json());
  const created = await createProLead(scope, session, input);
  return Response.json(created, { status: 201 });
});
