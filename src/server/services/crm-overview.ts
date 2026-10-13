import type { CrmRole } from '@prisma/client';
import type { ResolvedSession } from '@/lib/auth/resolve';
import type { PortalScope } from '@/lib/db/with-portal';
import { countBySemantic, fetchSectionItems } from '@/lib/bitrix/section-stats';
import { m, sum } from '@/domain/finance/money';
import { zonedParts, zonedTime } from '@/domain/analytics/time';
import { analyticsTimeZone } from './analytics';
import { listCrmSections } from './portal-setup';

/**
 * «Продажи и обращения» (ADR-041): this month's leads, deals and sales smart processes by
 * what the portal said each section is for — traffic or sales — with where they ended up.
 */

export interface SectionOverview {
  entityTypeId: number;
  title: string;
  role: Extract<CrmRole, 'TRAFFIC' | 'SALES'>;
  created: number;
  inWork: number;
  won: number;
  lost: number;
  wonAmount: string;
  truncated: boolean;
  error: string | null;
}

const TTL_MS = 10 * 60_000;
const globalForCache = globalThis as unknown as {
  __crmOverview?: Map<string, { at: number; sections: SectionOverview[]; error: string | null }>;
};
const cache = (globalForCache.__crmOverview ??= new Map());

export function monthBounds(now: Date, tz: string): { from: Date; to: Date } {
  const p = zonedParts(now, tz);
  const from = zonedTime(tz, p.year, p.month, 1);
  const to =
    p.month === 12 ? zonedTime(tz, p.year + 1, 1, 1) : zonedTime(tz, p.year, p.month + 1, 1);
  return { from, to };
}

export async function loadCrmOverview(
  session: ResolvedSession,
  scope: PortalScope,
): Promise<{ sections: SectionOverview[]; error: string | null }> {
  if (session.demo) return { sections: [], error: null };
  // A new save of «Настройка под портал» changes the sections, so it starts a fresh entry.
  const key = `${session.portal.id}:${session.portal.setupCompletedAt?.getTime() ?? 0}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { sections: hit.sections, error: hit.error };

  let sections: SectionOverview[] = [];
  let error: string | null = null;
  try {
    const { from, to } = monthBounds(new Date(), analyticsTimeZone());
    const wanted = (await listCrmSections(session.portal, scope)).filter(
      (s): s is typeof s & { role: 'TRAFFIC' | 'SALES' } =>
        s.role === 'TRAFFIC' || s.role === 'SALES',
    );
    sections = [];
    for (const s of wanted) {
      try {
        const { items, semantics, truncated } = await fetchSectionItems(
          session.portal,
          s.entityTypeId,
          from,
          to,
        );
        const c = countBySemantic(items, semantics);
        sections.push({
          entityTypeId: s.entityTypeId,
          title: s.title,
          role: s.role,
          created: items.length,
          inWork: c.inWork,
          won: c.won,
          lost: c.lost,
          wonAmount: sum(c.wonAmounts.map((a) => m(a))).toString(),
          truncated,
          error: null,
        });
      } catch (err) {
        sections.push({
          entityTypeId: s.entityTypeId,
          title: s.title,
          role: s.role,
          created: 0,
          inWork: 0,
          won: 0,
          lost: 0,
          wonAmount: '0',
          truncated: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  cache.set(key, { at: Date.now(), sections, error });
  return { sections, error };
}
