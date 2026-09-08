import type { AppRole } from '@prisma/client';
import { db } from '@/lib/db/client';
import { forbidden, notFound } from '@/lib/errors';
import { DEMO_MEMBER_ID } from '@/lib/demo/constants';

export { DEMO_MEMBER_ID };

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

/** Throw unless demo mode is on — guards the demo-only role switch (ТЗ §5). */
export function assertDemoMode(): void {
  if (!isDemoMode()) throw forbidden('Демо-режим отключён.');
}

/** The demo portal, or null if it hasn't been seeded yet. */
export function findDemoPortal() {
  return db.portalInstallation.findUnique({ where: { memberId: DEMO_MEMBER_ID } });
}

/**
 * Pick the demo user to act as for a given role. EMPLOYEE resolves to a specific seeded
 * employee so member-scoping is demonstrable.
 */
export async function demoUserForRole(role: AppRole) {
  const portal = await findDemoPortal();
  if (!portal) throw notFound('Демо-портал ещё не создан. Запустите seed.');

  const user = await db.appUser.findFirst({
    where: { portalId: portal.id, role },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) throw notFound(`В демо-данных нет пользователя с ролью ${role}.`);
  return { portal, user };
}
