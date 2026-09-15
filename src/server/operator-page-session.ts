import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { OPERATOR_COOKIE, verifyOperatorSession } from '@/lib/operator/session';

/** For operator RSC pages: resolve the operator session or bounce to /operator/login. */
export async function requireOperatorSession(): Promise<{ operatorEmail: string }> {
  const jar = await cookies();
  const session = await verifyOperatorSession(jar.get(OPERATOR_COOKIE)?.value);
  if (!session) redirect('/operator/login');
  return session;
}
