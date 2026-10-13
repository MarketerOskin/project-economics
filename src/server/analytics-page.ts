import { redirect } from 'next/navigation';
import { requirePageSession } from '@/server/page-session';
import { analyticsTimeZone, loadAnalytics, peopleNames, type AnalyticsWorld } from '@/server/services/analytics';
import { parseAnalyticsPeriod, type AnalyticsPeriod, type Filters } from '@/domain/analytics';
import { can } from '@/lib/permissions';
import type { ResolvedSession } from '@/lib/auth/resolve';
import type { PortalScope } from '@/lib/db/with-portal';

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface AnalyticsPageContext {
  session: ResolvedSession;
  scope: PortalScope;
  pro: boolean;
  world: AnalyticsWorld;
  period: AnalyticsPeriod;
  filters: Filters;
  /** Selected project filter (overview pages), if any. */
  projectFilter?: string;
  /** "?p=…&m=…" — the period, to carry into links. */
  periodQuery: string;
  names: Record<string, string>;
  projectNames: Record<string, string>;
}

const EMPTY_WORLD = (tz: string): AnalyticsWorld => ({
  tz,
  now: new Date(),
  projects: [],
  people: new Map(),
  fetchedAt: null,
  unlinked: [],
  staffIds: [],
});

/**
 * Shared prologue of every «Аналитика» page: manager/admin only, Pro only (the page renders the
 * upsell itself — `pro` false means nothing was loaded from Bitrix24), period + filters from
 * the URL, and the analytics world for the portal (or one project).
 */
export async function analyticsPage(
  searchParams: SearchParams,
  opts: { projectId?: string } = {},
): Promise<AnalyticsPageContext> {
  const { session, scope } = await requirePageSession();
  if (!can.viewAllProjects(session.actor) || session.portal.disabledSections.includes('analytics')) {
    redirect(opts.projectId ? `/projects/${opts.projectId}` : '/');
  }

  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const pro = session.plan === 'PRO';
  const tz = analyticsTimeZone();
  const period = parseAnalyticsPeriod({ p: get('p'), m: get('m'), from: get('from'), to: get('to') }, tz);

  const projectFilter = opts.projectId ?? get('projectId');
  const world = pro
    ? await loadAnalytics(session, scope, { projectId: projectFilter, refresh: get('refresh') === '1' })
    : EMPTY_WORLD(tz);

  const keep = new URLSearchParams();
  for (const k of ['p', 'm', 'from', 'to']) {
    const v = get(k);
    if (v) keep.set(k, v);
  }
  const periodQuery = keep.toString() ? `?${keep.toString()}` : '';

  const names = peopleNames(world);

  return {
    session,
    scope,
    pro,
    world,
    period,
    filters: { employeeId: get('employeeId') || undefined },
    projectFilter: opts.projectId ? undefined : projectFilter,
    periodQuery,
    names,
    projectNames: Object.fromEntries(world.projects.map((p) => [p.projectId, p.name])),
  };
}

/** Problems worth showing above the numbers: refused rights, Bitrix24 down, calendar off. */
export function loadProblems(world: AnalyticsWorld): Array<{ name: string; text: string }> {
  const out: Array<{ name: string; text: string }> = [];
  for (const p of world.projects) {
    if (p.error) out.push({ name: p.name, text: p.stale ? `${p.error} Показаны данные прошлой загрузки.` : p.error });
    if (p.meetingsError) out.push({ name: p.name, text: `встречи не загружены — ${p.meetingsError}` });
  }
  return out;
}
