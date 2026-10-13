/**
 * Analytics inputs (ADR-034): what Bitrix24 tasks, time records and project-calendar meetings
 * look like once parsed. Durations are whole seconds — hours here are effort, not money, and
 * become money only inside src/domain/finance/support-package.ts.
 */

/** Bitrix24 task status codes (tasks.task.list `status`). */
export const TASK_STATUS = {
  NEW: '1',
  PENDING: '2',
  IN_PROGRESS: '3',
  SUPPOSEDLY_COMPLETED: '4',
  COMPLETED: '5',
  DEFERRED: '6',
  DECLINED: '7',
} as const;

export const TASK_STATUS_LABELS: Record<string, string> = {
  '1': 'Новая',
  '2': 'Ждёт',
  '3': 'В работе',
  '4': 'Ждёт приёмки',
  '5': 'Завершена',
  '6': 'Отложена',
  '7': 'Отклонена',
};

export interface TaskStat {
  id: number;
  /** Project (app Project.id) the task was loaded for. */
  projectId: string;
  title: string;
  status: string;
  created: Date | null;
  started: Date | null;
  closed: Date | null;
  deadline: Date | null;
  /** Bitrix24 user id of the responsible person. */
  responsibleId: string | null;
  responsibleName: string;
  url: string | null;
  /**
   * Kanban stage of the project's task board («Новые», «Тестирование»…) when the project is a
   * Bitrix24 group with its own stages (ADR-050); null — the plain status is shown instead.
   */
  stage?: string | null;
}

/** What a task's status reads as: its board stage when there is one, else the Bitrix status. */
export function taskStatusLabel(t: Pick<TaskStat, 'status' | 'stage'>): string {
  return t.stage || TASK_STATUS_LABELS[t.status] || t.status;
}

/** Key for grouping and filtering by status: the stage name, or the status code. */
export function taskStatusKey(t: Pick<TaskStat, 'status' | 'stage'>): string {
  return t.stage ? `stage:${t.stage}` : t.status;
}

/** A status key back to its label (see taskStatusKey). */
export function statusKeyLabel(key: string): string {
  return key.startsWith('stage:') ? key.slice(6) : (TASK_STATUS_LABELS[key] ?? key);
}

export interface TimeEntry {
  taskId: number;
  /** Bitrix24 user id who logged the time. */
  userId: string;
  seconds: number;
  at: Date;
  comment: string;
}

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  start: Date;
  end: Date;
  /** Bitrix24 user ids: the host plus everyone who accepted. */
  attendeeIds: string[];
}

export function meetingSeconds(m: Meeting): number {
  return Math.round((m.end.getTime() - m.start.getTime()) / 1000);
}

/** Everything analytics knows about one project for the requested window. */
export interface ProjectActivity {
  projectId: string;
  name: string;
  /** Monthly hours package; null = no limit set. */
  limitHours: number | null;
  tasks: TaskStat[];
  entries: TimeEntry[];
  meetings: Meeting[];
}
