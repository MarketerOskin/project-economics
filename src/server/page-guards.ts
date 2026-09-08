import { notFound, redirect } from 'next/navigation';
import { AppError } from '@/lib/errors';

/**
 * Run an RSC data loader, mapping domain errors to the right Next UI:
 * 404 → not-found.tsx, 403 → redirect to a safe page, anything else re-thrown to error.tsx.
 */
export async function loadOr404<T>(fn: () => Promise<T>, forbiddenRedirect = '/'): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) {
      if (err.httpStatus === 404) notFound();
      if (err.httpStatus === 403) redirect(forbiddenRedirect);
    }
    throw err;
  }
}
