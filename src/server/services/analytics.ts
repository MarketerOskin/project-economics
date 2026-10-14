import type { Project } from '@prisma/client';
import type { ResolvedSession } from '@/lib/auth/resolve';
import type { PortalScope } from '@/lib/db/with-portal';
import { isDemoMode } from '@/lib/auth/demo';
import { crmTaskBindings } from '@/lib/bitrix/tasks';
import { syncUsersIfStale } from '@/lib/bitrix/users';
import { MAX_TASKS_PER_PROJECT, fetchGroupMeetings, fetchTasks, fetchTimeEntries, type TaskSource } from '@/lib/bitrix/analytics';
import { fetchRelatedItems, type RelatedGroup, type TimeFieldMap } from '@/lib/bitrix/related';
import { demoActivity } from '@/lib/demo/analytics-data';
import { isFinished, type StageRules } from '@/domain/crm/stages';
import { loadStageRules } from './stage-rules';
import { addDays, dayKey, startOfDay } from '@/domain/analytics/time';
import { hoursOnClose } from '@/domain/analytics/close-date';
import { TASK_STATUS, type Meeting, type ProjectActivity, type TaskStat, type TimeEntry } from '@/domain/analytics/types';

/**
 * Loads support analytics for a portal (ADR-034). Bitrix24 stays the source of truth: tasks,
 * time records and project-calendar meetings are read live and kept in memory for a few
 * minutes, the way the statistics.toxick.ru dashboard did — no nightly copy that is always a
 * day behind. A project counts when it was imported from Bitrix24: a «Проекты» group (tasks +
 * group calendar) or a CRM entity (tasks bound to it; CRM has no calendar).
 */

const TTL_MS = 5 * 60_000;
/**
 * Older than TTL_MS but younger than this, cached data is shown at once and refreshed in the
 * background (ADR-057); older still, the page waits for Bitrix24 as on a cold start.
 */
const STALE_MS = 24 * 60 * 60_000;
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
/** Loads in progress, so two pages asking for one project share one round of Bitrix24 calls. */
const inflight = new Map<string, Promise<CacheEntry>>();

function loadOnce(key: string, load: () => Promise<CacheEntry>): Promise<CacheEntry> {
  const running = inflight.get(key);
  if (running) return running;
  const p: Promise<CacheEntry> = load()
    .then((fresh) => {
      // Invalidated while loading (settings changed): don't cache data read under the old ones.
      if (inflight.get(key) === p) cache.set(key, fresh);
      return fresh;
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/** Drop cached data for a portal (or one project) — e.g. after the package settings change. */
export function invalidateAnalytics(portalId: string, projectId?: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${portalId}:`) && (!projectId || key === `${portalId}:${projectId}`)) cache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(`${portalId}:`) && (!projectId || key === `${portalId}:${projectId}`)) inflight.delete(key);
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

/** Where CRM types keep time spent on an item (ADR-040), by entityTypeId. */
export async function timeFieldMaps(scope: PortalScope): Promise<Map<number, TimeFieldMap>> {
  const rows = await scope.crmTimeField.findMany();
  return new Map(
    rows
      .filter((r) => r.hoursField || r.minutesField)
      .map((r) => [r.entityTypeId, { hoursField: r.hoursField, minutesField: r.minutesField, userField: r.userField }]),
  );
}

/**
 * Linked CRM elements as tasks and time records (ADR-040, ADR-046, ADR-058): an element is a
 * "task" (negative id from its type and id, so it never collides with a Bitrix24 task or
 * another project's element), titled with its section and showing its stage while open. Its
 * field time is one record, dated when the element was finished, and none while it is still
 * open. An element without field time is a row only when no Bitrix24 task is bound to it
 * (`untracked`): otherwise its work is in those tasks and it would be counted twice (ADR-051).
 */
export function relatedAsActivity(
  groups: RelatedGroup[],
  projectId: string,
  untracked: Set<string> = new Set(),
): { tasks: TaskStat[]; entries: TimeEntry[] } {
  const tasks: TaskStat[] = [];
  const entries: TimeEntry[] = [];
  for (const g of groups) {
    for (const i of g.items) {
      const hasTime = Boolean(i.seconds && i.seconds > 0);
      if (!hasTime && !untracked.has(elementKey(g.entityTypeId, i.id))) continue;
      const id = -(g.entityTypeId * 10_000_000 + Number(i.id));
      const stage = i.stageId ? g.stages[i.stageId] : undefined;
      const semantic = stage?.semantic ?? 'process';
      const finished = isFinished(semantic);
      tasks.push({
        id,
        projectId,
        title: `${g.title}: ${i.title}`,
        status: semantic === 'success' || semantic === 'closed' ? TASK_STATUS.COMPLETED : semantic === 'fail' ? TASK_STATUS.DECLINED : TASK_STATUS.IN_PROGRESS,
        stage: finished ? null : (stage?.name ?? null),
        created: i.createdAt,
        started: i.createdAt,
        closed: finished ? i.movedAt : null,
        deadline: null,
        responsibleId: i.assignedById,
        responsibleName: '',
        url: i.url,
      });
      // Hours count once the element is finished, on that date (ADR-055); an open element's
      // time is not in any period yet.
      const at = finished ? (i.movedAt ?? i.createdAt) : null;
      const userId = i.workerId ?? i.assignedById;
      if (hasTime && at && userId) {
        entries.push({ taskId: id, userId, seconds: i.seconds!, at, comment: g.title });
      }
    }
  }
  return { tasks, entries };
}

function elementKey(entityTypeId: number, id: string | number): string {
  return `${entityTypeId}:${id}`;
}

/** Bitrix24 bindings (UF_CRM_TASK) asked for in one tasks.task.list call. */
const BINDINGS_PER_CALL = 40;

/**
 * Everything linked CRM elements bring into a CRM project's tasks and hours (ADR-046): the
 * elements themselves as rows (with time from mapped fields), plus the Bitrix24 tasks bound
 * to elements that carry no field time, with those tasks' time records. Elements with field
 * time don't contribute their tasks' time too, so nothing is counted twice. A failure here
 * leaves the project's own tasks intact.
 */
async function relatedActivity(
  session: ResolvedSession,
  project: Project,
  timeFields: Map<number, TimeFieldMap>,
  skipTypes: Set<number>,
  knownTaskIds: Set<number>,
  stageRules: StageRules,
): Promise<{ tasks: TaskStat[]; entries: TimeEntry[] }> {
  try {
    const groups = await fetchRelatedItems(session.portal, project.crmEntityTypeId!, project.crmEntityId!, {
      timeFields,
      skipTypes,
      stageRules,
    });
    const noTime = groups.flatMap((g) => g.items.filter((i) => !i.seconds).map((i) => ({ g, i })));
    const bindings = noTime.flatMap(({ g, i }) => crmTaskBindings(g.entityTypeId, i.id));
    const bound: TaskStat[] = [];
    const withTime: number[] = [];
    const boundTo = new Set<string>();
    for (let i = 0; i < bindings.length && bound.length < MAX_TASKS_PER_PROJECT; i += BINDINGS_PER_CALL) {
      const page = await fetchTasks(session.portal, { kind: 'crm', bindings: bindings.slice(i, i + BINDINGS_PER_CALL) }, project.id);
      for (const { spentSeconds, crmBindings, ...t } of page) {
        for (const b of crmBindings) boundTo.add(b);
        if (knownTaskIds.has(t.id)) continue;
        knownTaskIds.add(t.id);
        bound.push(t);
        if (spentSeconds > 0) withTime.push(t.id);
      }
    }
    // Elements with no field time and no task of their own are still work items (ADR-058).
    const untracked = new Set(
      noTime
        .filter(({ g, i }) => !crmTaskBindings(g.entityTypeId, i.id).some((b) => boundTo.has(b)))
        .map(({ g, i }) => elementKey(g.entityTypeId, i.id)),
    );
    const out = relatedAsActivity(groups, project.id, untracked);
    out.tasks.push(...bound);
    if (withTime.length) out.entries.push(...(await fetchTimeEntries(session.portal, withTime)));
    return out;
  } catch {
    return { tasks: [], entries: [] };
  }
}

async function loadFromBitrix(
  session: ResolvedSession,
  project: Project,
  source: TaskSource,
  tz: string,
  now: Date,
  timeFields: Map<number, TimeFieldMap>,
  skipTypes: Set<number>,
  stageRules: StageRules,
): Promise<CacheEntry> {
  const tasksWithSpent = await fetchTasks(session.portal, source, project.id);
  const withTime = tasksWithSpent.filter((t) => t.spentSeconds > 0).map((t) => t.id);
  const entries = withTime.length ? await fetchTimeEntries(session.portal, withTime) : [];
  const tasks: TaskStat[] = tasksWithSpent.map(({ spentSeconds, crmBindings, ...t }) => (void spentSeconds, void crmBindings, t));

  if (source.kind === 'crm' && project.crmEntityTypeId && project.crmEntityId) {
    const extra = await relatedActivity(session, project, timeFields, skipTypes, new Set(tasks.map((t) => t.id)), stageRules);
    tasks.push(...extra.tasks);
    entries.push(...extra.entries);
  }

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
      return { ...base(p), ...a, entries: hoursOnClose(a.tasks, a.entries), sourceKind: 'demo' as const, error: null, meetingsError: null, stale: false, fetchedAt: now };
    });
  } else {
    const eligible = projects.map((p) => ({ p, source: sourceOf(p) })).filter((x): x is { p: Project; source: TaskSource } => x.source !== null);
    const timeFields = await timeFieldMaps(scope);
    // Sections set to «Не использовать» in the portal setup (ADR-041) bring nothing in.
    const skipTypes = new Set((await scope.crmSectionRole.findMany()).filter((r) => r.role === 'IGNORE').map((r) => r.entityTypeId));
    const stageRules = await loadStageRules(scope);
    result = await pool(eligible, CONCURRENCY, async ({ p, source }) => {
      const key = `${session.portal.id}:${p.id}`;
      const cached = cache.get(key);
      const load = () => loadFromBitrix(session, p, source, tz, now, timeFields, skipTypes, stageRules);
      const age = cached ? Date.now() - cached.at : Infinity;
      if (cached && !opts.refresh && age < TTL_MS) {
        return toProject(p, source, cached, null, false);
      }
      if (cached && !opts.refresh && age < STALE_MS) {
        // Show what we have now; the next visit gets the refreshed data.
        loadOnce(key, load).catch(() => undefined);
        return toProject(p, source, cached, null, false);
      }
      try {
        const fresh = await loadOnce(key, load);
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
      entries: hoursOnClose(data.tasks, data.entries),
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
