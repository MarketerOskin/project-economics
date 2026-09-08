import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { testDb, resetDb, seedPortal } from '../../helpers/db';
import { encryptToken } from '@/lib/bitrix/crypto';
import { syncUsers } from '@/lib/bitrix/users';

process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString('base64');

describe('syncUsers (ТЗ §6)', () => {
  beforeEach(resetDb);
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
});
