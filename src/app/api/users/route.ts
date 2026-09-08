import { route } from '@/server/handler';

export const dynamic = 'force-dynamic';

/**
 * Portal employees for member pickers / filters. Reads the local snapshot (ТЗ §6);
 * a background Bitrix sync is wired in Phase 10. In demo mode these are the seeded users.
 */
export const GET = route(async ({ req, scope }) => {
  const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase();

  const users = await scope.user.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const filtered = q
    ? users.filter((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q))
    : users;

  return {
    users: filtered.map((u) => ({
      id: u.id,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      firstName: u.firstName,
      lastName: u.lastName,
      photoUrl: u.photoUrl,
      position: u.position,
      role: u.role,
    })),
  };
});
