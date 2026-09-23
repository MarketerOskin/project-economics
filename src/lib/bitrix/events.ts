import { db } from '@/lib/db/client';
import { purgePortalData } from './portal-data';

export interface EventHandlingResult {
  status: number;
  body: { ok: true } | { error: string };
}

/**
 * Bitrix24 outbound events (ONAPPUNINSTALL and friends). Shared between /api/bitrix/events
 * (its documented target, via event.bind) and /api/bitrix/install (some Bitrix app
 * configurations — notably "rest-only" apps — deliver lifecycle events to the SAME URL as
 * the install handler instead of a separately bound one; see ADR-030). Every event carries
 * `auth[application_token]` — verified against the portal's stored token before acting, so
 * an attacker who merely knows a `member_id` cannot deactivate a portal / wipe its data.
 */
export async function handleBitrixEvent(payload: Record<string, string | undefined>): Promise<EventHandlingResult> {
  const event = payload.event;
  if (!event) return { status: 200, body: { ok: true } };

  const memberId = payload['auth[member_id]'] ?? payload['data[MEMBER_ID]'] ?? payload.member_id;
  const appToken = payload['auth[application_token]'] ?? payload.application_token;

  const portal = memberId ? await db.portalInstallation.findUnique({ where: { memberId } }) : null;
  if (!portal || !appToken || !portal.applicationToken || portal.applicationToken !== appToken) {
    return { status: 401, body: { error: 'Invalid application token' } };
  }

  if (event === 'ONAPPUNINSTALL' || event === 'ONAPPUNINSTALLED') {
    if (payload['data[CLEAN]'] === '1' && !portal.isDemo) {
      await purgePortalData(portal.id);
    } else {
      await db.portalInstallation.update({
        where: { id: portal.id },
        data: { isActive: false, authTokenEnc: null, refreshTokenEnc: null },
      });
    }
  }

  return { status: 200, body: { ok: true } };
}
