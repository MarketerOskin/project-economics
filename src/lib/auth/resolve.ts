import type { AppUser, PortalInstallation } from '@prisma/client';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import type { Actor } from '@/lib/permissions';
import { SESSION_COOKIE, verifySession } from './session';

export interface ResolvedSession {
  portal: PortalInstallation;
  user: AppUser;
  actor: Actor;
  demo: boolean;
}

/** Role is always recomputed from the DB record — never trusted from the cookie (ТЗ §44). */
export function resolveRole(user: AppUser): Actor['role'] {
  if (user.isBitrixAdmin) return 'ADMIN';
  return user.role;
}

/**
 * Validate a session token against the database. Returns null when the token is invalid,
 * the portal is inactive, or the user is missing / inactive / from another portal.
 * The cookie's role claim is ignored — the role comes from the fresh `AppUser` row.
 */
export async function resolveSessionFromToken(
  token: string | undefined | null,
): Promise<ResolvedSession | null> {
  const payload = await verifySession(token);
  if (!payload) return null;

  const [portal, user] = await Promise.all([
    db.portalInstallation.findUnique({ where: { id: payload.portalId } }),
    db.appUser.findUnique({ where: { id: payload.appUserId } }),
  ]);

  if (!portal || !portal.isActive) return null;
  if (!user || !user.isActive || user.portalId !== portal.id) return null;

  return {
    portal,
    user,
    demo: portal.isDemo,
    actor: { role: resolveRole(user), appUserId: user.id },
  };
}

/** RSC / server-action entry point: reads the cookie jar, then validates. */
export async function resolveSession(): Promise<ResolvedSession | null> {
  const jar = await cookies();
  return resolveSessionFromToken(jar.get(SESSION_COOKIE)?.value);
}
