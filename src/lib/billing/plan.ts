import type { Plan } from '@prisma/client';
import { forbidden } from '@/lib/errors';

/**
 * Plan resolution + free-tier limits. Billing is manual for now (ТЗ: the operator grants
 * PRO by hand — see src/lib/operator/ — ahead of a Marketplace payment integration). Every
 * gate here is enforced on the server; the frontend only mirrors it for the upsell UI.
 */

export interface PlanSource {
  plan: Plan;
  planExpiresAt: Date | null;
}

/** A PRO grant past its expiry reverts to FREE — never trust the stored `plan` alone. */
export function effectivePlan(source: PlanSource): Plan {
  if (source.plan === 'PRO' && source.planExpiresAt && source.planExpiresAt < new Date()) {
    return 'FREE';
  }
  return source.plan;
}

export const FREE_LIMITS = {
  /** Active (non-archived) projects a FREE portal may have at once. */
  maxActiveProjects: 3,
} as const;

/** Throw a 403 with an upsell-flavoured message when the portal isn't on PRO. */
export function requirePro(plan: Plan, feature: string): void {
  if (plan !== 'PRO') {
    throw forbidden(`«${feature}» доступно на тарифе Pro. Оформите Pro, чтобы открыть эту функцию.`);
  }
}
