import { forbidden } from '@/lib/errors';

/**
 * Portal allowlist (anti-unauthorized-deployment).
 *
 * When `ALLOWED_PORTAL_MEMBER_IDS` and/or `ALLOWED_PORTAL_DOMAINS` is set, only the listed
 * Bitrix24 portals may install or open the app — an unknown portal is refused at install
 * time and at the placement handler. When both are empty (the default) the allowlist is
 * disabled, so local development and `docker compose up` keep working out of the box.
 *
 * The demo portal is always allowed — a running `DEMO_MODE` instance is meant to be public.
 *
 * This is a deterrent, not DRM: an operator who self-hosts the source can remove the check.
 * Its point is to make unauthorized production use a deliberate act, on top of the
 * proprietary licence in `LICENSE`.
 */
function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export interface PortalIdentity {
  memberId: string;
  domain: string;
  isDemo?: boolean;
}

export function allowlistEnabled(): boolean {
  return (
    parseList(process.env.ALLOWED_PORTAL_MEMBER_IDS).length > 0 ||
    parseList(process.env.ALLOWED_PORTAL_DOMAINS).length > 0
  );
}

export function isPortalAuthorized(portal: PortalIdentity): boolean {
  if (portal.isDemo) return true;
  if (!allowlistEnabled()) return true;
  const members = parseList(process.env.ALLOWED_PORTAL_MEMBER_IDS);
  const domains = parseList(process.env.ALLOWED_PORTAL_DOMAINS);
  return (
    members.includes(portal.memberId.toLowerCase()) ||
    domains.includes(portal.domain.toLowerCase())
  );
}

/** Throw a 403 when the portal is not on the allowlist. */
export function assertPortalAuthorized(portal: PortalIdentity): void {
  if (!isPortalAuthorized(portal)) {
    throw forbidden(
      'Этот портал Bitrix24 не авторизован для использования приложения. Обратитесь к правообладателю.',
    );
  }
}
