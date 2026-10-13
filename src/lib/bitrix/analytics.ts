import type { PortalInstallation } from '@prisma/client';
import { batchBitrix, callBitrix } from './client';
import { zonedTime } from '@/domain/analytics/time';
import type { Meeting, TaskStat, TimeEntry } from '@/domain/analytics/types';

/**
 * Bitrix24 -> analytics inputs (ADR-034). Field quirks below were verified on a live portal by
 * the statistics.toxick.ru dashboard this section was ported from.
 */

const PAGE = 50;
/** Hard cap per project so one huge group can't stall the page. */
export const MAX_TASKS_PER_PROJECT = 2000;
/** Meetings longer than this are calendar noise (a "busy all week" block), not work. */
const MAX_MEETING_SECONDS = 12 * 3600;

const TASK_SELECT = [
  'ID', 'TITLE', 'STATUS', 'GROUP_ID', 'CREATED_DATE', 'DATE_START', 'CLOSED_DATE',
  'RESPONSIBLE_ID', 'TIME_SPENT_IN_LOGS', 'DEADLINE', 'STAGE_ID',
];

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface RawTask {
  id?: string | number;
  title?: string;
  status?: string | number;
  createdDate?: string;
  dateStart?: string;
  closedDate?: string;
  deadline?: string;
  responsibleId?: string | number;
  responsible?: { name?: string };
  timeSpentInLogs?: string | number;
  stageId?: string | number;
}

export function parseTask(raw: RawTask, projectId: string, urlFor: (task: { id: number; responsibleId: string | null }) => string): TaskStat & { spentSeconds: number } {
  const id = toInt(raw.id);
  const responsibleId = toInt(raw.responsibleId) ? String(toInt(raw.responsibleId)) : null;
  return {
    id,
    projectId,
    title: raw.title ?? '',
    status: String(raw.status ?? ''),
    created: toDate(raw.createdDate),
    started: toDate(raw.dateStart),
    closed: toDate(raw.closedDate),
    deadline: toDate(raw.deadline),
    responsibleId,
    responsibleName: raw.responsible?.name ?? '',
    url: urlFor({ id, responsibleId }),
    spentSeconds: toInt(raw.timeSpentInLogs),
  };
}

interface RawStage {
  ID?: string | number;
  TITLE?: string;
  SORT?: string | number;
}

/**
 * Stage names of a group's task board (task.stages.get), id -> title (ADR-050). Tasks that
 * were never moved carry STAGE_ID 0 and sit in the first stage. Empty when the group has no
 * board or the call is refused — the plain status is shown then.
 */
export async function fetchTaskStages(portal: PortalInstallation, groupId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const raw = await callBitrix<Record<string, RawStage> | RawStage[]>(portal, 'task.stages.get', { entityId: groupId });
    const list = (Array.isArray(raw) ? raw : Object.values(raw ?? {})).filter((r) => r.ID && r.TITLE);
    list.sort((a, b) => toInt(a.SORT) - toInt(b.SORT));
    for (const r of list) out.set(String(toInt(r.ID)), String(r.TITLE));
    if (list[0]) out.set('0', String(list[0].TITLE));
  } catch {
    // No board or no access: statuses stay as they are.
  }
  return out;
}

export interface RawElapsed {
  TASK_ID?: string | number;
  USER_ID?: string | number;
  SECONDS?: string | number;
  SOURCE?: string | number;
  DATE_START?: string;
  CREATED_DATE?: string;
  COMMENT_TEXT?: string;
}

/**
 * One time record. Bitrix's auto-timer leaves 1-second records on start/stop (SOURCE=3); those
 * are noise and never count as hours.
 */
export function parseElapsed(raw: RawElapsed): TimeEntry | null {
  const seconds = toInt(raw.SECONDS);
  if (String(raw.SOURCE) === '3' && seconds < 60) return null;
  const at = toDate(raw.DATE_START) ?? toDate(raw.CREATED_DATE);
  if (!at || seconds <= 0) return null;
  return {
    taskId: toInt(raw.TASK_ID),
    userId: String(toInt(raw.USER_ID)),
    seconds,
    at,
    comment: (raw.COMMENT_TEXT ?? '').trim(),
  };
}

/** "ДД.ММ.ГГГГ ЧЧ:ММ:СС" in the event's own zone. */
function parseCalendarTime(value: unknown, tzName: unknown, fallbackTz: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = match.map(Number) as number[];
  let tz = fallbackTz;
  if (typeof tzName === 'string' && tzName) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tzName });
      tz = tzName;
    } catch {
      tz = fallbackTz;
    }
  }
  return zonedTime(tz, yyyy!, mm!, dd!, hh!, mi!, ss!);
}

export interface RawCalendarEvent {
  ID?: string | number;
  NAME?: string;
  ACTIVE?: string;
  DELETED?: string;
  DT_SKIP_TIME?: string;
  DATE_FROM?: string;
  DATE_TO?: string;
  TZ_FROM?: string;
  TZ_TO?: string;
  MEETING_HOST?: string | number;
  CREATED_BY?: string | number;
  ATTENDEE_LIST?: Array<{ id?: string | number; status?: string }>;
}

/**
 * One project-calendar event. Inactive, deleted and all-day events never count. The *_TS_UTC
 * fields are off by the zone offset on real portals, so DATE_FROM/DATE_TO + TZ_FROM are used.
 * Attendees: the host plus everyone who accepted; with nobody, the creator.
 */
export function parseCalendarEvent(raw: RawCalendarEvent, projectId: string, fallbackTz: string): Meeting | null {
  if (raw.ACTIVE !== 'Y' || raw.DELETED === 'Y' || raw.DT_SKIP_TIME === 'Y') return null;
  const start = parseCalendarTime(raw.DATE_FROM, raw.TZ_FROM, fallbackTz);
  const end = parseCalendarTime(raw.DATE_TO, raw.TZ_TO || raw.TZ_FROM, fallbackTz);
  if (!start || !end || end <= start) return null;
  if ((end.getTime() - start.getTime()) / 1000 > MAX_MEETING_SECONDS) return null;

  const attendees = new Set<string>();
  for (const a of raw.ATTENDEE_LIST ?? []) {
    if (a && (a.status === 'Y' || a.status === 'H') && toInt(a.id)) attendees.add(String(toInt(a.id)));
  }
  if (toInt(raw.MEETING_HOST)) attendees.add(String(toInt(raw.MEETING_HOST)));
  if (attendees.size === 0 && toInt(raw.CREATED_BY)) attendees.add(String(toInt(raw.CREATED_BY)));

  return {
    id: String(toInt(raw.ID)),
    projectId,
    title: raw.NAME || 'Без названия',
    start,
    end,
    attendeeIds: [...attendees].sort(),
  };
}

// ─── Network ────────────────────────────────────────────────────────────────

export type TaskSource = { kind: 'group'; groupId: string } | { kind: 'crm'; bindings: string[] };

function taskUrl(portal: PortalInstallation, source: TaskSource, task: { id: number; responsibleId: string | null }): string {
  if (source.kind === 'group') {
    return `https://${portal.domain}/workgroups/group/${source.groupId}/tasks/task/view/${task.id}/`;
  }
  return `https://${portal.domain}/company/personal/user/${task.responsibleId ?? 0}/tasks/task/view/${task.id}/`;
}

/** Tasks of a «Проекты» group (GROUP_ID) or bound to a CRM entity (UF_CRM_TASK), newest first. */
export async function fetchTasks(
  portal: PortalInstallation,
  source: TaskSource,
  projectId: string,
): Promise<Array<TaskStat & { spentSeconds: number }>> {
  const filter = source.kind === 'group' ? { GROUP_ID: source.groupId } : { UF_CRM_TASK: source.bindings };
  const raw: RawTask[] = [];
  for (let start = 0; raw.length < MAX_TASKS_PER_PROJECT; start += PAGE) {
    const res = await callBitrix<{ tasks?: RawTask[] }>(portal, 'tasks.task.list', {
      filter,
      select: TASK_SELECT,
      order: { ID: 'desc' },
      start,
    });
    const page = res?.tasks ?? [];
    raw.push(...page);
    if (page.length < PAGE) break;
  }
  const tasks = raw.slice(0, MAX_TASKS_PER_PROJECT).map((r) => parseTask(r, projectId, (t) => taskUrl(portal, source, t)));
  if (source.kind === 'group' && tasks.length) {
    const stages = await fetchTaskStages(portal, source.groupId);
    if (stages.size) {
      raw.slice(0, MAX_TASKS_PER_PROJECT).forEach((r, i) => {
        tasks[i]!.stage = stages.get(String(toInt(r.stageId))) ?? null;
      });
    }
  }
  return tasks;
}

/** Time records of the given tasks, 50 tasks per batch request. */
export async function fetchTimeEntries(portal: PortalInstallation, taskIds: number[]): Promise<TimeEntry[]> {
  const out: TimeEntry[] = [];
  for (let i = 0; i < taskIds.length; i += PAGE) {
    const chunk = taskIds.slice(i, i + PAGE);
    const calls = Object.fromEntries(
      chunk.map((id) => [`t${id}`, { method: 'task.elapseditem.getlist', params: { TASKID: id } }]),
    );
    const results = await batchBitrix(portal, calls);
    for (const [key, items] of Object.entries(results ?? {})) {
      const taskId = Number(key.slice(1));
      for (const item of Array.isArray(items) ? (items as RawElapsed[]) : []) {
        const e = parseElapsed({ TASK_ID: taskId, ...item });
        if (e) out.push(e);
      }
    }
  }
  return out;
}

/**
 * Meetings from a «Проекты» group calendar (calendar.event.get type=group). Personal calendars
 * are deliberately not read: a project meeting is mirrored into every attendee's calendar and
 * would be counted many times over. Recurring events arrive as instances — de-duplicated by
 * id + start.
 */
export async function fetchGroupMeetings(
  portal: PortalInstallation,
  groupId: string,
  projectId: string,
  range: { from: string; to: string },
  tz: string,
): Promise<Meeting[]> {
  const raw = await callBitrix<RawCalendarEvent[]>(portal, 'calendar.event.get', {
    type: 'group',
    ownerId: groupId,
    from: range.from,
    to: range.to,
  });
  const seen = new Set<string>();
  const out: Meeting[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const meeting = parseCalendarEvent(r, projectId, tz);
    if (!meeting) continue;
    const key = `${meeting.id}:${meeting.start.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(meeting);
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
