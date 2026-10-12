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

  // Deactivate users the portal no longer reports. An empty answer is never the real staff
  // list (the caller is on it), so it deactivates no one.
  if (seen.size > 0) {
    await db.appUser.updateMany({
      where: { portalId: portal.id, bitrixUserId: { notIn: [...seen] }, isActive: true },
      data: { isActive: false },
    });
  }
  await db.portalInstallation.update({
    where: { id: portal.id },
    data: { usersSyncedAt: new Date() },
  });

  return { synced: seen.size };
}

/**
 * Pull the employee list when the last full pull is older than an hour (or never happened).
 * Errors are swallowed: a stale list is better than a broken page.
 */
export async function syncUsersIfStale(
  portal: PortalInstallation,
  opts: { force?: boolean } = {},
): Promise<void> {
  const { usersSyncedAt } = await db.portalInstallation.findUniqueOrThrow({
    where: { id: portal.id },
    select: { usersSyncedAt: true },
  });
  const age = usersSyncedAt ? Date.now() - usersSyncedAt.getTime() : Infinity;
  if (opts.force || age > STALE_MS) {
    await syncUsers(portal).catch(() => undefined);
  }
}
