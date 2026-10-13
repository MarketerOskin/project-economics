import { redirect } from 'next/navigation';
import { requirePageSession } from '@/server/page-session';
import { homePath } from '@/lib/sections';

export const dynamic = 'force-dynamic';

/** The main screen is analytics; roles without it land on the finance overview. */
export default async function HomePage() {
  const { session } = await requirePageSession();
  redirect(homePath(session.actor.role, session.portal.disabledSections));
}
