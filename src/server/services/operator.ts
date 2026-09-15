import type { Plan } from '@prisma/client';
import { db } from '@/lib/db/client';
import { badRequest } from '@/lib/errors';
import { effectivePlan } from '@/lib/billing/plan';

export interface PortalSummary {
  id: string;
  memberId: string;
  domain: string;
  isDemo: boolean;
  isActive: boolean;
  installedAt: Date;
  plan: Plan;
  /** The stored plan resolved against expiry — what the portal actually gets right now. */
  effectivePlan: Plan;
  planExpiresAt: Date | null;
  planNote: string | null;
  projectCount: number;
  userCount: number;
}

/** Every portal, newest install first, optionally filtered by domain/member_id substring. */
export async function listPortalsForOperator(q?: { search?: string }): Promise<PortalSummary[]> {
  const search = q?.search?.trim();
  const portals = await db.portalInstallation.findMany({
    where: search
      ? {
          OR: [
            { domain: { contains: search, mode: 'insensitive' } },
            { memberId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { installedAt: 'desc' },
    include: { _count: { select: { projects: true, users: true } } },
  });

  return portals.map((p) => ({
    id: p.id,
    memberId: p.memberId,
    domain: p.domain,
    isDemo: p.isDemo,
    isActive: p.isActive,
    installedAt: p.installedAt,
    plan: p.plan,
    effectivePlan: effectivePlan(p),
    planExpiresAt: p.planExpiresAt,
    planNote: p.planNote,
    projectCount: p._count.projects,
    userCount: p._count.users,
  }));
}

export interface GrantHistoryRow {
  id: string;
  plan: Plan;
  expiresAt: Date | null;
  note: string | null;
  operatorEmail: string;
  createdAt: Date;
}

export async function getPortalGrantHistory(portalId: string): Promise<GrantHistoryRow[]> {
  const rows = await db.operatorGrant.findMany({
    where: { portalId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows;
}

/** Grant or revoke a plan. Every change is logged to OperatorGrant — who, when, until when. */
export async function setPortalPlan(input: {
  portalId: string;
  plan: Plan;
  expiresAt: Date | null;
  note: string | null;
  operatorEmail: string;
}): Promise<void> {
  const portal = await db.portalInstallation.findUnique({ where: { id: input.portalId } });
  if (!portal) throw badRequest('Портал не найден');

  await db.$transaction([
    db.portalInstallation.update({
      where: { id: input.portalId },
      data: { plan: input.plan, planExpiresAt: input.expiresAt, planNote: input.note },
    }),
    db.operatorGrant.create({
      data: {
        portalId: input.portalId,
        operatorEmail: input.operatorEmail,
        plan: input.plan,
        expiresAt: input.expiresAt,
        note: input.note,
      },
    }),
  ]);
}
