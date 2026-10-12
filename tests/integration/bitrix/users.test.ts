import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { syncUsers, syncUsersIfStale } from '@/lib/bitrix/users';

process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

describe('syncUsers (ТЗ §6)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDb();
  });
  afterAll(async () => {
    await testDb.$disconnect();
    vi.restoreAllMocks();
  });

  it('upserts snapshots and deactivates users the portal no longer reports', async () => {
    const s = await seedPortal();
    const portal = await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/' },
    });

    // seedPortal made 3 users (bitrixUserId 1..3). Bitrix now reports only 1 and 2, plus a new 9.
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: [
            { ID: '1', NAME: 'Админ', LAST_NAME: 'Тестовый', WORK_POSITION: 'CEO' },
            { ID: '2', NAME: 'Менеджер', LAST_NAME: 'Тестовый' },
            { ID: '9', NAME: 'Новый', LAST_NAME: 'Сотрудник' },
          ],
        }),
        { status: 200 },
      ),
    );

    const { synced } = await syncUsers(portal);
    expect(synced).toBe(3);

    const users = await testDb.appUser.findMany({ where: { portalId: s.portalId }, orderBy: { bitrixUserId: 'asc' } });
    const byBid = Object.fromEntries(users.map((u) => [u.bitrixUserId, u]));
    expect(byBid['1']?.position).toBe('CEO');
    expect(byBid['3']?.isActive).toBe(false); // no longer reported -> deactivated
    expect(byBid['9']?.firstName).toBe('Новый');
  });

  async function connected() {
    const s = await seedPortal();
    const portal = await testDb.portalInstallation.update({
      where: { id: s.portalId },
      data: { authTokenEnc: encryptToken('ACCESS'), restEndpoint: 'https://x.bitrix24.ru/rest/' },
    });
    return { s, portal };
  }
  const staff = (ids: string[]) =>
    new Response(JSON.stringify({ result: ids.map((ID) => ({ ID, NAME: `Имя ${ID}`, LAST_NAME: 'Фамилия' })) }), { status: 200 });

  it('records the pull on the portal', async () => {
    const { s, portal } = await connected();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(staff(['1', '2', '3']));
    await syncUsers(portal);
    const after = await testDb.portalInstallation.findUniqueOrThrow({ where: { id: s.portalId } });
    expect(after.usersSyncedAt).not.toBeNull();
  });

  it('an empty answer deactivates no one', async () => {
    const { s, portal } = await connected();
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(staff([]));
    await syncUsers(portal);
    expect(await testDb.appUser.count({ where: { portalId: s.portalId, isActive: false } })).toBe(0);
  });

  it('pulls the list even when someone just signed in (fresh AppUser.lastSyncedAt)', async () => {
    const { s, portal } = await connected();
    // Signing in stamps lastSyncedAt on that one user; it used to make the whole list look fresh.
    await testDb.appUser.updateMany({ where: { portalId: s.portalId }, data: { lastSyncedAt: new Date() } });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(staff(['1', '2', '3', '42']));
    await syncUsersIfStale(portal);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await testDb.appUser.count({ where: { portalId: s.portalId, bitrixUserId: '42' } })).toBe(1);
  });

  it('skips the pull within an hour of the last one, unless forced', async () => {
    const { portal } = await connected();
    await testDb.portalInstallation.update({ where: { id: portal.id }, data: { usersSyncedAt: new Date() } });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(staff(['1', '2', '3']));
    await syncUsersIfStale(portal);
    expect(fetchSpy).not.toHaveBeenCalled();
    await syncUsersIfStale(portal, { force: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
