import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route } from '@/server/handler';
import { assertDemoMode, demoUserForRole } from '@/lib/auth/demo';
import { issueSession } from '@/lib/auth/issue';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']) });

/**
 * Demo-only role switch (ТЗ §5). Re-issues the session as a seeded user of the chosen role.
 * 403 unless DEMO_MODE=true — not a capability in production.
 */
export const POST = route(async ({ req }) => {
  assertDemoMode();
  const { role } = bodySchema.parse(await req.json());
  const { portal, user } = await demoUserForRole(role);

  const res = NextResponse.json({
    role,
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName },
  });
  return issueSession(res, { portalId: portal.id, appUserId: user.id, role, demo: true });
});
