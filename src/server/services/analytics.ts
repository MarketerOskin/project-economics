import type { Project } from '@prisma/client';
import type { ResolvedSession } from '@/lib/auth/resolve';
import type { PortalScope } from '@/lib/db/with-portal';
import { isDemoMode } from '@/lib/auth/demo';
import { crmTaskBindings } from '@/lib/bitrix/tasks';
import { syncUsersIfStale } from '@/lib/bitrix/users';
import { fetchGroupMeetings, fetchTasks, fetchTimeEntries, type TaskSource } from '@/lib/bitrix/analytics';
import { demoActivity } from '@/lib/demo/analytics-data';
import { addDays, dayKey, startOfDay } from '@/domain/analytics/time';
import type { Meeting, ProjectActivity, TaskStat, TimeEntry } from '@/domain/analytics/types';

/**
 * Loads support analytics for a portal (ADR-034). Bitrix24 stays the source of truth: tasks,
 * time records and project-calendar meetings are read live and kept in memory for a few
 * minutes, the way the statistics.toxick.ru dashboard did — no nightly copy that is always a
 * day behind. A project counts when it was imported from Bitrix24: a «Проекты» group (tasks +
 * group calendar) or a CRM entity (tasks bound to it; CRM has no calendar).
 */

const TTL_MS = 5 * 60_000;
const CONCURRENCY = 3;

export function analyticsTimeZone(): string {
  const tz = process.env.ANALYTICS_TZ || 'Europe/Moscow';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'Europe/Moscow';
  }
}

export interface AnalyticsProject extends ProjectActivity {
  clientName: string | null;
  bitrixUrl: string | null;
  sourceKind: 'group' | 'crm' | 'demo';
  monthlyFee: string | null;
  hourRate: string | null;
  /** Bitrix24 refused or failed; tasks may be empty or from an older load (`stale`). */
  error: string | null;
  meetingsError: string | null;
  stale: boolean;
  fetchedAt: Date;
}

export interface AnalyticsPerson {
  bitrixUserId: string;
  name: string;
  photoUrl: string | null;
  position: string | null;
}

export interface AnalyticsWorld {
  tz: string;
  now: Date;
  projects: AnalyticsProject[];
  people: Map<string, AnalyticsPerson>;
  /** Oldest load among the projects shown — "данные на ЧЧ:ММ". */
  fetchedAt: Date | null;
  /** Active projects made by hand: no Bitrix24 source yet, so no numbers until linked. */
  unlinked: Array<{ id: string; name: string }>;
  /** Active portal staff (Bitrix24 user ids), so the team page lists people with no activity too. */
  staffIds: string[];
}

interface CacheEntry {
  at: number;
  tasks: TaskStat[];
  entries: TimeEntry[];
  meetings: Meeting[];
  meetingsError: string | null;
}

const globalForCache = globalThis as unknown as { __analyticsCache?: Map<string, CacheEntry> };
const cache = (globalForCache.__analyticsCache ??= new Map<string, CacheEntry>());

/** Drop cached data for a portal (or one project) — e.g. after the package settings change. */
export function invalidateAnalytics(portalId: string, projectId?: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${portalId}:`) && (!projectId || key === `${portalId}:${projectId}`)) cache.delete(key);
  }
}

function sourceOf(p: Project): TaskSource | null {
  if (p.sourceType === 'BITRIX_PROJECT' && p.crmEntityId) return { kind: 'group', groupId: p.crmEntityId };
  if (p.sourceType === 'BITRIX_CRM' && p.crmEntityTypeId && p.crmEntityId) {
    return { kind: 'crm', bindings: crmTaskBindings(p.crmEntityTypeId, p.crmEntityId) };
  }
  return null;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function loadFromBitrix(session: ResolvedSession, project: Project, source: TaskSource, tz: string, now: Date): Promise<CacheEntry> {
  const tasksWithSpent = await fetchTasks(session.portal, source, project.id);
  const withTime = tasksWithSpent.filter((t) => t.spentSeconds > 0).map((t) => t.id);
  const entries = withTime.length ? await fetchTimeEntries(session.portal, withTime) : [];
  const tasks: TaskStat[] = tasksWithSpent.map(({ spentSeconds, ...t }) => (void spentSeconds, t));

  let meetings: Meeting[] = [];
  let meetingsError: string | null = null;
  if (source.kind === 'group') {
    const today = startOfDay(now, tz);
    try {
      meetings = await fetchGroupMeetings(
        session.portal,
        source.groupId,
        project.id,
        { from: dayKey(addDays(today, -400, tz), tz), to: dayKey(addDays(today, 60, tz), tz) },
        tz,
      );
    } catch (err) {
      meetingsError = errorText(err);
    }
  }
  return { at: Date.now(), tasks, entries, meetings, meetingsError };
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function loadAnalytics(
  session: ResolvedSession,
  scope: PortalScope,
  opts: { projectId?: string; refresh?: boolean } = {},
): Promise<AnalyticsWorld> {
  const tz = analyticsTimeZone();
  const now = new Date();
  const demo = isDemoMode() || session.demo;

  // Names and the team list come from the portal's staff list, not only from who has opened
  // the app; refresh it here (hourly, or on «Обновить»).
  if (!demo) await syncUsersIfStale(session.portal, { force: opts.refresh });

  const [allProjects, users] = await Promise.all([
    scope.project.findMany({
      where: { status: { not: 'ARCHIVED' }, ...(opts.projectId ? { id: opts.projectId } : {}) },
      orderBy: { name: 'asc' },
    }),
    scope.user.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
  ]);
  const projects = demo ? allProjects : allProjects.filter((p) => sourceOf(p) !== null);
  const unlinked = demo ? [] : allProjects.filter((p) => sourceOf(p) === null).map((p) => ({ id: p.id, name: p.name }));
  const staffIds = users.filter((u) => u.isActive).map((u) => u.bitrixUserId);

  const people = new Map<string, AnalyticsPerson>(
    users.map((u) => [
      u.bitrixUserId,
      {
        bitrixUserId: u.bitrixUserId,
        name: `${u.firstName} ${u.lastName}`.trim() || `Сотрудник ${u.bitrixUserId}`,
        photoUrl: u.photoUrl,
        position: u.position,
      },
    ]),
  );

  const base = (p: Project) => ({
    projectId: p.id,
    name: p.name,
    clientName: p.clientName,
    bitrixUrl: p.crmEntityUrl,
    limitHours: p.supportHoursLimit !== null ? Number(p.supportHoursLimit) : null,
    monthlyFee: p.supportMonthlyFee?.toString() ?? null,
    hourRate: p.supportHourRate?.toString() ?? null,
  });

  let result: AnalyticsProject[];
  if (demo) {
    const staff = users
      .filter((u) => u.isActive)
      .map((u) => ({ bitrixUserId: u.bitrixUserId, name: `${u.firstName} ${u.lastName}`.trim() }));
    const allIds = (await scope.project.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } })).map((p) => p.id);
    result = projects.map((p) => {
      const a = demoActivity({ id: p.id, index: Math.max(0, allIds.indexOf(p.id)) }, staff, tz, now);
      return { ...base(p), ...a, sourceKind: 'demo' as const, error: null, meetingsError: null, stale: false, fetchedAt: now };
    });
  } else {
    const eligible = projects.map((p) => ({ p, source: sourceOf(p) })).filter((x): x is { p: Project; source: TaskSource } => x.source !== null);
    result = await pool(eligible, CONCURRENCY, async ({ p, source }) => {
      const key = `${session.portal.id}:${p.id}`;
      const cached = cache.get(key);
      if (cached && !opts.refresh && Date.now() - cached.at < TTL_MS) {
        return toProject(p, source, cached, null, false);
      }
      try {
        const fresh = await loadFromBitrix(session, p, source, tz, now);
        cache.set(key, fresh);
        return toProject(p, source, fresh, null, false);
      } catch (err) {
        if (cached) return toProject(p, source, cached, errorText(err), true);
        return toProject(p, source, { at: Date.now(), tasks: [], entries: [], meetings: [], meetingsError: null }, errorText(err), false);
      }
    });
  }

  function toProject(p: Project, source: TaskSource, data: CacheEntry, error: string | null, stale: boolean): AnalyticsProject {
    return {
      ...base(p),
      tasks: data.tasks,
      entries: data.entries,
      meetings: data.meetings,
      sourceKind: source.kind,
      error,
      meetingsError: data.meetingsError,
      stale,
      fetchedAt: new Date(data.at),
    };
  }

  const fetchedAt = result.length ? new Date(Math.min(...result.map((r) => r.fetchedAt.getTime()))) : null;
  return { tz, now, projects: result, people, fetchedAt, unlinked, staffIds };
}

/** Display name for a Bitrix24 user id, falling back to the task's responsible name. */
export function personName(world: AnalyticsWorld, bitrixUserId: string): string {
  const known = world.people.get(bitrixUserId);
  if (known) return known.name;
  for (const p of world.projects) {
    const t = p.tasks.find((x) => x.responsibleId === bitrixUserId && x.responsibleName);
    if (t) return t.responsibleName;
  }
  return `Сотрудник ${bitrixUserId}`;
}

/** Bitrix24 user id -> display name for everyone appearing in the world. */
export function peopleNames(world: AnalyticsWorld): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [id, person] of world.people) names[id] = person.name;
  for (const p of world.projects) {
    for (const t of p.tasks) {
      if (t.responsibleId && !names[t.responsibleId]) names[t.responsibleId] = personName(world, t.responsibleId);
    }
    for (const e of p.entries) if (!names[e.userId]) names[e.userId] = personName(world, e.userId);
    for (const x of p.meetings) for (const a of x.attendeeIds) if (!names[a]) names[a] = personName(world, a);
  }
  return names;
}
