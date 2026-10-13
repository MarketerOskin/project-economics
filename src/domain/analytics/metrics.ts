import { daysBetween, dayKey } from './time';
import { MONTHS, monthPeriod, monthsTouched } from './period';
import {
  TASK_STATUS,
  meetingSeconds,
  type Meeting,
  type ProjectActivity,
  type TaskStat,
  type TimeEntry,
} from './types';

/**
 * Support analytics, pure (ADR-034): no network, no DB. Ported from the statistics.toxick.ru
 * dashboard so both count hours identically:
 *  - hours of a period = time records dated inside it, plus meetings that have already started;
 *  - a meeting counts ONCE towards its project's hours (and the monthly package), but in full
 *    towards every attendee's personal load;
 *  - reaction = taken into work − created, resolution = closed − created.
 */

export interface Window {
  start: Date;
  end: Date;
}

export interface Filters {
  /** Bitrix24 user id. */
  employeeId?: string;
  status?: string;
}

const inWindow = (d: Date | null, w: Window): d is Date => d !== null && d >= w.start && d < w.end;
const isOpen = (t: TaskStat) => t.status !== TASK_STATUS.COMPLETED && t.status !== TASK_STATUS.DECLINED;
const isDoneIn = (t: TaskStat, w: Window) => t.status === TASK_STATUS.COMPLETED && inWindow(t.closed, w);
/** A meeting enters hours only once it has started (future ones stay in the schedule). */
const held = (m: Meeting, now: Date) => m.start <= now;

function taskMatches(t: TaskStat, f: Filters): boolean {
  return (!f.employeeId || t.responsibleId === f.employeeId) && (!f.status || t.status === f.status);
}

function avg(xs: number[]): number | null {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export function reactionSeconds(t: TaskStat): number | null {
  return t.started && t.created && t.started >= t.created
    ? Math.round((t.started.getTime() - t.created.getTime()) / 1000)
    : null;
}

export function resolutionSeconds(t: TaskStat): number | null {
  return t.closed && t.created && t.closed >= t.created
    ? Math.round((t.closed.getTime() - t.created.getTime()) / 1000)
    : null;
}

// ─── Monthly package usage ──────────────────────────────────────────────────

export interface MonthUsage {
  /** 'YYYY-MM' */
  month: string;
  label: string;
  taskSeconds: number;
  meetingSeconds: number;
  totalSeconds: number;
  limitSeconds: number | null;
  overageSeconds: number;
}

/** Package usage per calendar month the window touches — always for the whole project. */
export function monthUsage(p: ProjectActivity, w: Window, tz: string, now: Date): MonthUsage[] {
  const limitSeconds = p.limitHours !== null ? Math.round(p.limitHours * 3600) : null;
  return monthsTouched(w, tz).map(([y, m]) => {
    const mp = monthPeriod(y, m, tz);
    const taskSeconds = p.entries.filter((e) => inWindow(e.at, mp)).reduce((a, e) => a + e.seconds, 0);
    const meetSeconds = p.meetings
      .filter((x) => held(x, now) && inWindow(x.start, mp))
      .reduce((a, x) => a + meetingSeconds(x), 0);
    const total = taskSeconds + meetSeconds;
    return {
      month: mp.month!,
      label: `${MONTHS[m - 1]} ${y}`,
      taskSeconds,
      meetingSeconds: meetSeconds,
      totalSeconds: total,
      limitSeconds,
      overageSeconds: limitSeconds === null ? 0 : Math.max(0, total - limitSeconds),
    };
  });
}

/**
 * Seconds each person put into a project in one calendar month ('YYYY-MM'): their time
 * records plus, in full, every meeting they attended that has started (ADR-045).
 */
export function monthSecondsByPerson(p: ProjectActivity, month: string, tz: string, now: Date): Map<string, number> {
  const [y, mo] = month.split('-').map(Number) as [number, number];
  const mp = monthPeriod(y, mo, tz);
  const out = new Map<string, number>();
  const add = (userId: string, s: number) => out.set(userId, (out.get(userId) ?? 0) + s);
  for (const e of p.entries) if (inWindow(e.at, mp)) add(e.userId, e.seconds);
  for (const x of p.meetings) {
    if (!held(x, now) || !inWindow(x.start, mp)) continue;
    for (const a of x.attendeeIds) add(a, meetingSeconds(x));
  }
  return out;
}

// ─── Project summary ────────────────────────────────────────────────────────

export interface Summary {
  created: number;
  done: number;
  openNow: number;
  overdue: number;
  avgReactionSeconds: number | null;
  medianReactionSeconds: number | null;
  avgResolutionSeconds: number | null;
  taskSeconds: number;
  meetingSeconds: number;
  totalSeconds: number;
  meetings: number;
}

function summarizeParts(
  tasks: TaskStat[],
  entries: TimeEntry[],
  meetings: Meeting[],
  w: Window,
  now: Date,
  f: Filters,
): Summary {
  const ft = tasks.filter((t) => taskMatches(t, f));
  const created = ft.filter((t) => inWindow(t.created, w));
  const done = ft.filter((t) => isDoneIn(t, w));
  const open = ft.filter(isOpen);
  const reactions = created.map(reactionSeconds).filter((x): x is number => x !== null);
  const resolutions = done.map(resolutionSeconds).filter((x): x is number => x !== null);
  const taskSeconds = entries
    .filter((e) => (!f.employeeId || e.userId === f.employeeId) && inWindow(e.at, w))
    .reduce((a, e) => a + e.seconds, 0);
  const heldMeetings = meetings.filter(
    (m) => held(m, now) && inWindow(m.start, w) && (!f.employeeId || m.attendeeIds.includes(f.employeeId)),
  );
  const meetSeconds = heldMeetings.reduce((a, m) => a + meetingSeconds(m), 0);
  return {
    created: created.length,
    done: done.length,
    openNow: open.length,
    overdue: open.filter((t) => t.deadline && t.deadline < now).length,
    avgReactionSeconds: avg(reactions),
    medianReactionSeconds: median(reactions),
    avgResolutionSeconds: avg(resolutions),
    taskSeconds,
    meetingSeconds: meetSeconds,
    totalSeconds: taskSeconds + meetSeconds,
    meetings: heldMeetings.length,
  };
}

export function summarizeProject(p: ProjectActivity, w: Window, now: Date, f: Filters = {}): Summary {
  return summarizeParts(p.tasks, p.entries, p.meetings, w, now, f);
}

/** The same summary over several projects at once (overview KPIs). */
export function summarizeAll(projects: ProjectActivity[], w: Window, now: Date, f: Filters = {}): Summary {
  return summarizeParts(
    projects.flatMap((p) => p.tasks),
    projects.flatMap((p) => p.entries),
    projects.flatMap((p) => p.meetings),
    w,
    now,
    f,
  );
}

// ─── Task table ─────────────────────────────────────────────────────────────

export interface TaskRow {
  task: TaskStat;
  seconds: number;
  reactionSeconds: number | null;
  resolutionSeconds: number | null;
}

/** Tasks created, closed or worked on inside the window, newest first. */
export function taskRows(tasks: TaskStat[], entries: TimeEntry[], w: Window, f: Filters = {}): TaskRow[] {
  const byTask = new Map<number, number>();
  for (const e of entries) {
    if ((!f.employeeId || e.userId === f.employeeId) && inWindow(e.at, w)) {
      byTask.set(e.taskId, (byTask.get(e.taskId) ?? 0) + e.seconds);
    }
  }
  return tasks
    .filter((t) => taskMatches(t, f))
    .filter((t) => inWindow(t.created, w) || inWindow(t.closed, w) || byTask.has(t.id))
    .map((t) => ({
      task: t,
      seconds: byTask.get(t.id) ?? 0,
      reactionSeconds: reactionSeconds(t),
      resolutionSeconds: resolutionSeconds(t),
    }))
    .sort((a, b) => (b.task.created?.getTime() ?? 0) - (a.task.created?.getTime() ?? 0) || b.task.id - a.task.id);
}

// ─── Series ─────────────────────────────────────────────────────────────────

export interface DayPoint {
  /** 'YYYY-MM-DD' */
  day: string;
  taskSeconds: number;
  meetingSeconds: number;
  created: number;
  closed: number;
}

/** One point per day of the window: hours (tasks / meetings) and tasks created / closed. */
export function dailySeries(
  projects: ProjectActivity[],
  w: Window,
  tz: string,
  now: Date,
  f: Filters = {},
): DayPoint[] {
  const points = new Map<string, DayPoint>(
    daysBetween(w.start, w.end, tz).map((day) => [day, { day, taskSeconds: 0, meetingSeconds: 0, created: 0, closed: 0 }]),
  );
  for (const p of projects) {
    for (const e of p.entries) {
      if ((!f.employeeId || e.userId === f.employeeId) && inWindow(e.at, w)) {
        const pt = points.get(dayKey(e.at, tz));
        if (pt) pt.taskSeconds += e.seconds;
      }
    }
    for (const m of p.meetings) {
      if (held(m, now) && inWindow(m.start, w) && (!f.employeeId || m.attendeeIds.includes(f.employeeId))) {
        const pt = points.get(dayKey(m.start, tz));
        if (pt) pt.meetingSeconds += meetingSeconds(m);
      }
    }
    for (const t of p.tasks) {
      if (!taskMatches(t, f)) continue;
      if (inWindow(t.created, w)) {
        const pt = points.get(dayKey(t.created, tz));
        if (pt) pt.created += 1;
      }
      if (isDoneIn(t, w)) {
        const pt = points.get(dayKey(t.closed!, tz));
        if (pt) pt.closed += 1;
      }
    }
  }
  return [...points.values()];
}

export interface StatusSlice {
  status: string;
  count: number;
}

/** Tasks touched in the window, by current status. */
export function statusSplit(tasks: TaskStat[], w: Window, f: Filters = {}): StatusSlice[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (taskMatches(t, f) && (inWindow(t.created, w) || inWindow(t.closed, w))) {
      counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => ({ status, count }));
}

// ─── Meetings ───────────────────────────────────────────────────────────────

export interface MeetingRow {
  meeting: Meeting;
  held: boolean;
}

export function meetingRows(meetings: Meeting[], w: Window, now: Date, employeeId?: string): MeetingRow[] {
  return meetings
    .filter((m) => inWindow(m.start, w) && (!employeeId || m.attendeeIds.includes(employeeId)))
    .map((m) => ({ meeting: m, held: held(m, now) }))
    .sort((a, b) => a.meeting.start.getTime() - b.meeting.start.getTime() || a.meeting.id.localeCompare(b.meeting.id));
}

// ─── People ─────────────────────────────────────────────────────────────────

export interface EmployeeRow {
  userId: string;
  done: number;
  openNow: number;
  taskSeconds: number;
  meetingSeconds: number;
  meetings: number;
  totalSeconds: number;
}

/** Load per person across projects: everyone who owns a task, logged time or attended. */
export function teamOverview(projects: ProjectActivity[], w: Window, now: Date, knownIds: string[] = []): EmployeeRow[] {
  const tasks = projects.flatMap((p) => p.tasks);
  const entries = projects.flatMap((p) => p.entries);
  const meetings = projects.flatMap((p) => p.meetings);

  const ids = new Set(knownIds);
  for (const t of tasks) if (t.responsibleId) ids.add(t.responsibleId);
  for (const e of entries) ids.add(e.userId);
  for (const m of meetings) for (const a of m.attendeeIds) ids.add(a);

  const rows: EmployeeRow[] = [];
  for (const userId of ids) {
    const mine = tasks.filter((t) => t.responsibleId === userId);
    const taskSeconds = entries.filter((e) => e.userId === userId && inWindow(e.at, w)).reduce((a, e) => a + e.seconds, 0);
    const myMeetings = meetings.filter((m) => m.attendeeIds.includes(userId) && held(m, now) && inWindow(m.start, w));
    const meetSeconds = myMeetings.reduce((a, m) => a + meetingSeconds(m), 0);
    rows.push({
      userId,
      done: mine.filter((t) => isDoneIn(t, w)).length,
      openNow: mine.filter(isOpen).length,
      taskSeconds,
      meetingSeconds: meetSeconds,
      meetings: myMeetings.length,
      totalSeconds: taskSeconds + meetSeconds,
    });
  }
  return rows.sort((a, b) => b.totalSeconds - a.totalSeconds || b.done - a.done || a.userId.localeCompare(b.userId));
}

export interface ProjectShare {
  projectId: string;
  name: string;
  taskSeconds: number;
  meetingSeconds: number;
  done: number;
  totalSeconds: number;
}

export interface JournalRow {
  entry: TimeEntry;
  task: TaskStat | null;
  projectId: string;
}

export interface EmployeeProfile {
  summary: Summary;
  byProject: ProjectShare[];
  tasks: TaskRow[];
  meetings: MeetingRow[];
  journal: JournalRow[];
}

export function employeeProfile(userId: string, projects: ProjectActivity[], w: Window, now: Date): EmployeeProfile {
  const f: Filters = { employeeId: userId };
  const tasks = projects.flatMap((p) => p.tasks);
  const entries = projects.flatMap((p) => p.entries);
  const meetings = projects.flatMap((p) => p.meetings);

  const byProject: ProjectShare[] = projects
    .map((p) => {
      const s = summarizeProject(p, w, now, f);
      return {
        projectId: p.projectId,
        name: p.name,
        taskSeconds: s.taskSeconds,
        meetingSeconds: s.meetingSeconds,
        done: s.done,
        totalSeconds: s.totalSeconds,
      };
    })
    .filter((s) => s.totalSeconds > 0 || s.done > 0)
    .sort((a, b) => b.totalSeconds - a.totalSeconds || a.name.localeCompare(b.name));

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const journal = entries
    .filter((e) => e.userId === userId && inWindow(e.at, w))
    .map((e) => {
      const task = taskById.get(e.taskId) ?? null;
      return { entry: e, task, projectId: task?.projectId ?? '' };
    })
    .sort((a, b) => b.entry.at.getTime() - a.entry.at.getTime());

  return {
    summary: summarizeParts(tasks, entries, meetings, w, now, f),
    byProject,
    tasks: taskRows(tasks, entries, w, f),
    meetings: meetingRows(meetings, w, now, userId),
    journal,
  };
}

// ─── Overview slices (ADR-047) ──────────────────────────────────────────────

export interface SourceSlice {
  /** 'tasks', 'meetings', or `crm:<section title>` for time from linked CRM elements. */
  key: string;
  label: string;
  seconds: number;
}

/**
 * Where the period's hours came from: Bitrix24 task time, held meetings, and each CRM section
 * whose linked elements carry time in mapped fields (ADR-040: their records have a negative
 * task id and the section title as comment).
 */
export function hoursBySource(projects: ProjectActivity[], w: Window, now: Date, f: Filters = {}): SourceSlice[] {
  const out = new Map<string, SourceSlice>();
  const add = (key: string, label: string, s: number) => {
    const cur = out.get(key) ?? { key, label, seconds: 0 };
    cur.seconds += s;
    out.set(key, cur);
  };
  for (const p of projects) {
    for (const e of p.entries) {
      if ((f.employeeId && e.userId !== f.employeeId) || !inWindow(e.at, w)) continue;
      if (e.taskId < 0) add(`crm:${e.comment}`, e.comment || 'Элементы CRM', e.seconds);
      else add('tasks', 'Задачи', e.seconds);
    }
    for (const m of p.meetings) {
      if (held(m, now) && inWindow(m.start, w) && (!f.employeeId || m.attendeeIds.includes(f.employeeId))) {
        add('meetings', 'Встречи', meetingSeconds(m));
      }
    }
  }
  return [...out.values()].filter((s) => s.seconds > 0).sort((a, b) => b.seconds - a.seconds);
}

/** Meetings that haven't started yet, within `days` from now, soonest first. */
export function upcomingMeetings(meetings: Meeting[], now: Date, days = 30, employeeId?: string): Meeting[] {
  const until = new Date(now.getTime() + days * 86_400_000);
  return meetings
    .filter((m) => m.start > now && m.start <= until && (!employeeId || m.attendeeIds.includes(employeeId)))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
