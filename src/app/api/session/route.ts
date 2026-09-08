import { route } from '@/server/handler';

export const dynamic = 'force-dynamic';

/** Identity for the app shell: who am I, what role, is this demo mode. */
export const GET = route(async ({ session }) => {
  const { user, actor, demo } = session;
  return {
    demo,
    role: actor.role,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      photoUrl: user.photoUrl,
      position: user.position,
    },
  };
});
