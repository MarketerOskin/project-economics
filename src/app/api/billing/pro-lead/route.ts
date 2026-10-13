import { route } from '@/server/handler';
import { createProLeadSchema } from '@/server/dto/billing';
import { createProLead, getOpenProLead } from '@/server/services/billing';

export const dynamic = 'force-dynamic';

/** Whether this portal already has an open ("we'll get back to you") request of `?kind=`. */
export const GET = route(async ({ req, scope }) => {
  const kind = new URL(req.url).searchParams.get('kind') === 'IMPLEMENTATION' ? 'IMPLEMENTATION' : 'PRO';
  const lead = await getOpenProLead(scope, kind);
  return { pending: Boolean(lead), lead };
});

export const POST = route(async ({ req, session, scope }) => {
  const input = createProLeadSchema.parse(await req.json());
  const created = await createProLead(scope, session, input);
  return Response.json(created, { status: 201 });
});
