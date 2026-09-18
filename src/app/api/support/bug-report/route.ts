import { route } from '@/server/handler';
import { bugReportSchema } from '@/server/dto/support';
import { submitBugReport } from '@/server/services/support';

export const dynamic = 'force-dynamic';

export const POST = route(async ({ req, session }) => {
  const input = bugReportSchema.parse(await req.json());
  await submitBugReport(session, input);
  return { ok: true };
});
