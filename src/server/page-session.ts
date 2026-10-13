import { redirect } from 'next/navigation';
import { resolveSession } from '@/lib/auth/resolve';
import { withPortal, type PortalScope } from '@/lib/db/with-portal';
import type { ResolvedSession } from '@/lib/auth/resolve';
import type { SectionKey } from '@/lib/sections';

export interface PageSession {
  session: ResolvedSession;
  scope: PortalScope;
}

/**
 * For RSC pages: resolve the session or bounce to the demo bootstrap / a sign-in notice.
 * The proxy already handles the sessionless case in demo mode; this is the safety net.
 */
export async function requirePageSession(): Promise<PageSession> {
  const session = await resolveSession();
  if (!session) redirect('/api/demo/bootstrap?next=/');
  return { session, scope: withPortal(session.portal.id) };
}

/** Pages of a section the portal switched off (ADR-041) send people home. */
export function requireSection(session: ResolvedSession, key: SectionKey): void {
  if (session.portal.disabledSections.includes(key)) redirect('/');
}
