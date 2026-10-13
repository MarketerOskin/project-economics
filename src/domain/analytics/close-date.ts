import type { TaskStat, TimeEntry } from './types';

/**
 * Hours belong to the period a task was closed in (ADR-056): every time record of a closed task
 * is dated at its closing, and a task still open brings no hours into any period yet. Records
 * of tasks not in the list (not expected) are left as they are.
 */
export function hoursOnClose(tasks: TaskStat[], entries: TimeEntry[]): TimeEntry[] {
  const closedAt = new Map(tasks.map((t) => [t.id, t.closed]));
  const out: TimeEntry[] = [];
  for (const e of entries) {
    if (!closedAt.has(e.taskId)) {
      out.push(e);
      continue;
    }
    const closed = closedAt.get(e.taskId);
    if (closed) out.push({ ...e, at: closed });
  }
  return out;
}
