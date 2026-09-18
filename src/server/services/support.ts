import type { ResolvedSession } from '@/lib/auth/resolve';
import { reportBug } from '@/lib/support/report-bug';
import type { BugReportInput } from '@/server/dto/support';

function actorName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

export async function submitBugReport(session: ResolvedSession, input: BugReportInput): Promise<void> {
  await reportBug({
    description: input.description,
    portalDomain: session.portal.domain,
    authorName: actorName(session.user),
    pageUrl: input.pageUrl,
  });
}
