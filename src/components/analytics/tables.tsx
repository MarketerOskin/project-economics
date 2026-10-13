import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  formatDateIn,
  formatDateTimeIn,
  formatDuration,
  formatHours,
  formatTimeIn,
} from '@/lib/format';
import {
  taskStatusLabel,
  type TaskRow,
  type MeetingRow,
  type EmployeeRow,
  type JournalRow,
} from '@/domain/analytics';

const TH = 'px-3 py-2.5 font-medium';
const TD = 'px-3 py-2.5';

function Table({
  head,
  children,
  empty,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  empty?: string | null;
}) {
  return (
    <div className="border-border bg-surface overflow-x-auto border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-fg-tertiary border-b text-left font-mono text-[11px] tracking-[0.06em] uppercase">
            {head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? <p className="text-fg-tertiary px-4 py-8 text-center text-sm">{empty}</p> : null}
    </div>
  );
}

/** A task's title opens its card in the app; the arrow next to it opens it in Bitrix24. */
export function TaskLink({
  projectId,
  id,
  title,
  url,
}: {
  projectId: string;
  id: number;
  title: string;
  url: string | null;
}) {
  return (
    <span className="inline-flex items-start gap-1.5">
      <Link
        href={`/analytics/tasks/${id}?projectId=${projectId}`}
        className="hover:text-accent hover:underline"
      >
        {title}
      </Link>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Открыть в Битрикс24"
          className="text-fg-tertiary hover:text-accent"
        >
          <ExternalLink className="mt-1 size-3 shrink-0" />
        </a>
      ) : null}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  '5': 'text-positive',
  '3': 'text-accent',
  '7': 'text-fg-tertiary',
};

export function TasksTable({
  rows,
  tz,
  names,
  projectNames,
  limit = 300,
}: {
  rows: TaskRow[];
  tz: string;
  names: Record<string, string>;
  /** Show a project column (overview / employee pages). */
  projectNames?: Record<string, string>;
  limit?: number;
}) {
  const shown = rows.slice(0, limit);
  return (
    <>
      <Table
        empty={rows.length === 0 ? 'За период задач нет' : null}
        head={
          <>
            <th className={TH}>№</th>
            <th className={TH}>Задача</th>
            {projectNames ? <th className={TH}>Проект</th> : null}
            <th className={TH}>Статус</th>
            <th className={TH}>Создана</th>
            <th className={TH}>Реакция</th>
            <th className={TH}>Решение</th>
            <th className={TH}>Исполнитель</th>
            <th className={cn(TH, 'text-right')}>Время</th>
          </>
        }
      >
        {shown.map((r) => (
          <tr
            key={`${r.task.projectId}:${r.task.id}`}
            className="border-border border-b last:border-0"
          >
            <td className={cn(TD, 'text-fg-tertiary font-mono text-xs')}>{r.task.id}</td>
            <td className={cn(TD, 'max-w-[28rem] min-w-[14rem]')}>
              <TaskLink
                projectId={r.task.projectId}
                id={r.task.id}
                title={r.task.title}
                url={r.task.url}
              />
            </td>
            {projectNames ? (
              <td className={cn(TD, 'text-fg-secondary min-w-[10rem]')}>
                <Link
                  href={`/projects/${r.task.projectId}/analytics`}
                  className="hover:text-accent"
                >
                  {projectNames[r.task.projectId] ?? '—'}
                </Link>
              </td>
            ) : null}
            <td className={cn(TD, 'whitespace-nowrap', STATUS_TONE[r.task.status])}>
              {taskStatusLabel(r.task)}
            </td>
            <td className={cn(TD, 'text-fg-secondary whitespace-nowrap')}>
              {formatDateIn(r.task.created, tz)}
            </td>
            <td className={cn(TD, 'text-fg-secondary whitespace-nowrap')}>
              {formatDuration(r.reactionSeconds)}
            </td>
            <td className={cn(TD, 'text-fg-secondary whitespace-nowrap')}>
              {formatDuration(r.resolutionSeconds)}
            </td>
            <td className={cn(TD, 'whitespace-nowrap')}>
              {r.task.responsibleId ? (
                <Link
                  href={`/analytics/team/${r.task.responsibleId}`}
                  className="hover:text-accent"
                >
                  {names[r.task.responsibleId] ?? r.task.responsibleName ?? '—'}
                </Link>
              ) : (
                '—'
              )}
            </td>
            <td className={cn(TD, 'nums text-right whitespace-nowrap')}>
              {formatDuration(r.seconds)}
            </td>
          </tr>
        ))}
      </Table>
      {rows.length > shown.length ? (
        <p className="text-fg-tertiary mt-2 text-xs">
          Показаны {shown.length} из {rows.length} задач — полный список в выгрузке Excel.
        </p>
      ) : null}
    </>
  );
}

export function MeetingsTable({
  rows,
  tz,
  names,
  projectNames,
}: {
  rows: MeetingRow[];
  tz: string;
  names: Record<string, string>;
  projectNames?: Record<string, string>;
}) {
  return (
    <Table
      empty={rows.length === 0 ? 'Встреч за период нет' : null}
      head={
        <>
          <th className={TH}>Дата</th>
          <th className={TH}>Время</th>
          <th className={TH}>Встреча</th>
          {projectNames ? <th className={TH}>Проект</th> : null}
          <th className={TH}>Участники</th>
          <th className={cn(TH, 'text-right')}>Длительность</th>
        </>
      }
    >
      {rows.map(({ meeting: m, held }) => (
        <tr
          key={`${m.projectId}:${m.id}:${m.start.getTime()}`}
          className={cn('border-border border-b last:border-0', !held && 'text-fg-tertiary')}
        >
          <td className={cn(TD, 'whitespace-nowrap')}>{formatDateIn(m.start, tz)}</td>
          <td className={cn(TD, 'whitespace-nowrap')}>
            {formatTimeIn(m.start, tz)}–{formatTimeIn(m.end, tz)}
          </td>
          <td className={TD}>
            {m.title}
            {!held ? (
              <span className="ml-2 font-mono text-[10px] uppercase">запланирована</span>
            ) : null}
          </td>
          {projectNames ? (
            <td className={cn(TD, 'text-fg-secondary')}>
              <Link href={`/projects/${m.projectId}/analytics`} className="hover:text-accent">
                {projectNames[m.projectId] ?? '—'}
              </Link>
            </td>
          ) : null}
          <td className={cn(TD, 'text-fg-secondary')}>
            {m.attendeeIds.map((id, i) => (
              <span key={id}>
                <Link href={`/analytics/team/${id}`} className="hover:text-accent">
                  {names[id] ?? `Сотрудник ${id}`}
                </Link>
                {i < m.attendeeIds.length - 1 ? ', ' : ''}
              </span>
            ))}
          </td>
          <td className={cn(TD, 'nums text-right whitespace-nowrap')}>
            {formatDuration((m.end.getTime() - m.start.getTime()) / 1000)}
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function TeamTable({
  rows,
  names,
  query,
}: {
  rows: EmployeeRow[];
  names: Record<string, string>;
  query: string;
}) {
  return (
    <Table
      empty={rows.length === 0 ? 'За период никто не работал по проектам' : null}
      head={
        <>
          <th className={TH}>Сотрудник</th>
          <th className={cn(TH, 'text-right')}>Часы всего</th>
          <th className={cn(TH, 'text-right')}>Задачи</th>
          <th className={cn(TH, 'text-right')}>Встречи</th>
          <th className={cn(TH, 'text-right')}>Выполнено</th>
          <th className={cn(TH, 'text-right')}>Открыто сейчас</th>
        </>
      }
    >
      {rows.map((r) => (
        <tr key={r.userId} className="border-border border-b last:border-0">
          <td className={TD}>
            <Link
              href={`/analytics/team/${r.userId}${query}`}
              className="hover:text-accent font-medium"
            >
              {names[r.userId] ?? `Сотрудник ${r.userId}`}
            </Link>
          </td>
          <td className={cn(TD, 'nums text-right font-medium')}>{formatHours(r.totalSeconds)} ч</td>
          <td className={cn(TD, 'text-fg-secondary nums text-right')}>
            {formatHours(r.taskSeconds)} ч
          </td>
          <td className={cn(TD, 'text-fg-secondary nums text-right')}>
            {formatHours(r.meetingSeconds)} ч · {r.meetings}
          </td>
          <td className={cn(TD, 'nums text-right')}>{r.done}</td>
          <td className={cn(TD, 'nums text-right')}>{r.openNow}</td>
        </tr>
      ))}
    </Table>
  );
}

export function JournalTable({
  rows,
  tz,
  projectNames,
  names,
}: {
  rows: JournalRow[];
  tz: string;
  projectNames: Record<string, string>;
  /** Show who logged each record (lists across the team). */
  names?: Record<string, string>;
}) {
  return (
    <Table
      empty={rows.length === 0 ? 'Записей времени за период нет' : null}
      head={
        <>
          <th className={TH}>Когда</th>
          <th className={TH}>Задача</th>
          <th className={TH}>Проект</th>
          {names ? <th className={TH}>Сотрудник</th> : null}
          <th className={TH}>Комментарий</th>
          <th className={cn(TH, 'text-right')}>Время</th>
        </>
      }
    >
      {rows.map((r, i) => (
        <tr key={i} className="border-border border-b last:border-0">
          <td className={cn(TD, 'text-fg-secondary whitespace-nowrap')}>
            {formatDateTimeIn(r.entry.at, tz)}
          </td>
          <td className={TD}>
            {r.task ? (
              <TaskLink
                projectId={r.task.projectId}
                id={r.task.id}
                title={r.task.title}
                url={r.task.url}
              />
            ) : (
              `Задача ${r.entry.taskId}`
            )}
          </td>
          <td className={cn(TD, 'text-fg-secondary')}>
            {r.projectId ? (
              <Link href={`/projects/${r.projectId}/analytics`} className="hover:text-accent">
                {projectNames[r.projectId] ?? '—'}
              </Link>
            ) : (
              '—'
            )}
          </td>
          {names ? (
            <td className={cn(TD, 'whitespace-nowrap')}>
              <Link href={`/analytics/team/${r.entry.userId}`} className="hover:text-accent">
                {names[r.entry.userId] ?? `Сотрудник ${r.entry.userId}`}
              </Link>
            </td>
          ) : null}
          <td className={cn(TD, 'text-fg-tertiary')}>{r.entry.comment || '—'}</td>
          <td className={cn(TD, 'nums text-right whitespace-nowrap')}>
            {formatDuration(r.entry.seconds)}
          </td>
        </tr>
      ))}
    </Table>
  );
}
