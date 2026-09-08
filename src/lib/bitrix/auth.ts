import type { PortalInstallation } from '@prisma/client';
import { db } from '@/lib/db/client';
import { encryptToken } from './crypto';
import { callBitrix } from './client';
import type { BitrixCurrentUser } from './types';

/** Fields Bitrix POSTs to the install / handler endpoints. */
export interface BitrixAuthPayload {
  AUTH_ID: string;
  REFRESH_ID?: string;
  AUTH_EXPIRES?: string;
  member_id?: string;
  DOMAIN?: string;
  status?: string;
  APP_SID?: string;
  application_token?: string;
  PLACEMENT?: string;
  PLACEMENT_OPTIONS?: string;
}

const DEFAULT_CATEGORIES = [
  { kind: 'INCOME' as const, name: 'Доход', accentColor: 'green' },
  { kind: 'EXPENSE' as const, name: 'Внешние программисты', accentColor: 'blue' },
  { kind: 'EXPENSE' as const, name: 'Внутренние программисты', accentColor: 'violet' },
  { kind: 'EXPENSE' as const, name: 'Расходы на ИИ', accentColor: 'cyan' },
  { kind: 'EXPENSE' as const, name: 'Аренда сервера', accentColor: 'graphite' },
  { kind: 'EXPENSE' as const, name: 'Дивиденды', accentColor: 'burgundy' },
];

/** Provision (or update) a portal from an install POST, and seed its default categories. */
export async function upsertPortalFromInstall(payload: BitrixAuthPayload): Promise<PortalInstallation> {
  const memberId = payload.member_id;
  const domain = payload.DOMAIN;
  if (!memberId || !domain) throw new Error('Install payload missing member_id / DOMAIN');

  const expiresAt = payload.AUTH_EXPIRES
    ? new Date(Date.now() + Number(payload.AUTH_EXPIRES) * 1000)
    : new Date(Date.now() + 3600 * 1000);

  const portal = await db.portalInstallation.upsert({
    where: { memberId },
    create: {
      memberId,
      domain,
      restEndpoint: `https://${domain}/rest`,
      applicationToken: payload.application_token ?? null,
      authTokenEnc: encryptToken(payload.AUTH_ID),
      refreshTokenEnc: payload.REFRESH_ID ? encryptToken(payload.REFRESH_ID) : null,
      tokenExpiresAt: expiresAt,
      isActive: true,
    },
    update: {
      domain,
      applicationToken: payload.application_token ?? undefined,
      authTokenEnc: encryptToken(payload.AUTH_ID),
      refreshTokenEnc: payload.REFRESH_ID ? encryptToken(payload.REFRESH_ID) : undefined,
      tokenExpiresAt: expiresAt,
      isActive: true,
    },
  });

  const existing = await db.financeCategory.count({ where: { portalId: portal.id } });
  if (existing === 0) {
    await db.financeCategory.createMany({
      data: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, portalId: portal.id, sortOrder: i, isSystem: true })),
    });
  }

  return portal;
}

/** Bind the left-menu placement so the app shows in the Bitrix24 sidebar (ТЗ §2). */
export async function bindMenuPlacement(portal: PortalInstallation): Promise<void> {
  const handler = `${process.env.APP_URL}/api/bitrix/handler`;
  try {
    await callBitrix(portal, 'placement.bind', {
      PLACEMENT: 'LEFT_MENU',
      HANDLER: handler,
      TITLE: 'Экономика проектов',
    });
  } catch {
    // Non-fatal: the app can be opened without the menu item; log-free by design.
  }
}

/** Resolve the current Bitrix user for a handler request and mirror them into AppUser. */
export async function syncCurrentUser(portal: PortalInstallation) {
  const me = await callBitrix<BitrixCurrentUser>(portal, 'user.current');
  const isAdmin = me.ADMIN === true;

  const user = await db.appUser.upsert({
    where: { portalId_bitrixUserId: { portalId: portal.id, bitrixUserId: String(me.ID) } },
    create: {
      portalId: portal.id,
      bitrixUserId: String(me.ID),
      firstName: me.NAME ?? '',
      lastName: me.LAST_NAME ?? '',
      photoUrl: me.PERSONAL_PHOTO ?? null,
      position: me.WORK_POSITION ?? null,
      isActive: true,
      isBitrixAdmin: isAdmin,
      role: isAdmin ? 'ADMIN' : 'EMPLOYEE',
      lastSyncedAt: new Date(),
    },
    update: {
      firstName: me.NAME ?? '',
      lastName: me.LAST_NAME ?? '',
      photoUrl: me.PERSONAL_PHOTO ?? null,
      position: me.WORK_POSITION ?? null,
      isBitrixAdmin: isAdmin,
      // Never downgrade an explicitly granted MANAGER/ADMIN just because Bitrix says non-admin.
      ...(isAdmin ? { role: 'ADMIN' } : {}),
      lastSyncedAt: new Date(),
    },
  });

  return user;
}
