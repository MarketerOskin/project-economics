import type { PortalInstallation } from '@prisma/client';
import { db } from '@/lib/db/client';
import { callBitrix } from './client';
import type { BitrixUser } from './types';

const STALE_MS = 60 * 60 * 1000;

function fullName(u: BitrixUser): { firstName: string; lastName: string } {
  return { firstName: u.NAME ?? '', lastName: u.LAST_NAME ?? '' };
}

/**
 * Pull the portal's employee list (user_brief scope) and upsert local snapshots (ТЗ §6).
 * Users no longer returned by Bitrix are marked inactive, not deleted.
 */
export async function syncUsers(portal: PortalInstallation): Promise<{ synced: number }> {
  const seen = new Set<string>();
  let start = 0;
  for (;;) {
    const res = await callBitrix<BitrixUser[]>(portal, 'user.get', {
      FILTER: { ACTIVE: true },
      start,
    });
    const list = Array.isArray(res) ? res : [];
    for (const u of list) {
      seen.add(String(u.ID));
      const name = fullName(u);
      await db.appUser.upsert({
        where: { portalId_bitrixUserId: { portalId: portal.id, bitrixUserId: String(u.ID) } },
        create: {
          portalId: portal.id,
          bitrixUserId: String(u.ID),
          firstName: name.firstName,
          lastName: name.lastName,
          photoUrl: u.PERSONAL_PHOTO ?? null,
          position: u.WORK_POSITION ?? null,
          isActive: true,
          role: 'EMPLOYEE',
          lastSyncedAt: new Date(),
        },
        update: {
          firstName: name.firstName,
          lastName: name.lastName,
          photoUrl: u.PERSONAL_PHOTO ?? null,
          position: u.WORK_POSITION ?? null,
          isActive: true,
          lastSyncedAt: new Date(),
        },
      });
    }
    if (list.length < 50) break;
    start += 50;
  }

  // Deactivate users the portal no longer reports.
  await db.appUser.updateMany({
    where: { portalId: portal.id, bitrixUserId: { notIn: [...seen] }, isActive: true },
    data: { isActive: false },
  });

  return { synced: seen.size };
}

/** Sync if the newest snapshot is older than an hour. Fire-and-forget from read paths. */
export async function syncUsersIfStale(portal: PortalInstallation): Promise<void> {
  const newest = await db.appUser.findFirst({
    where: { portalId: portal.id },
    orderBy: { lastSyncedAt: 'desc' },
    select: { lastSyncedAt: true },
  });
  const age = newest?.lastSyncedAt ? Date.now() - newest.lastSyncedAt.getTime() : Infinity;
  if (age > STALE_MS) {
    await syncUsers(portal).catch(() => undefined);
  }
}
