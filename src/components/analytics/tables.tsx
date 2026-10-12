import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDateIn, formatDateTimeIn, formatDuration, formatHours, formatTimeIn } from '@/lib/format';
import { TASK_STATUS_LABELS, type TaskRow, type MeetingRow, type EmployeeRow, type JournalRow } from '@/domain/analytics';

const TH = 'px-3 py-2.5 font-medium';
const TD = 'px-3 py-2.5';

function Table({ head, children, empty }: { head: React.ReactNode; children: React.ReactNode; empty?: string | null }) {
  return (
    <div className="overflow-x-auto border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.06em] text-fg-tertiary">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? <p className="px-4 py-8 text-center text-sm text-fg-tertiary">{empty}</p> : null}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = { '5': 'text-positive', '3': 'text-accent', '7': 'text-fg-tertiary' };

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
          <tr key={`${r.task.projectId}:${r.task.id}`} className="border-b border-border last:border-0">
            <td className={cn(TD, 'font-mono text-xs text-fg-tertiary')}>{r.task.id}</td>
            <td className={cn(TD, 'max-w-[28rem]')}>
              {r.task.url ? (
                <a href={r.task.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 hover:text-accent">
                  <span>{r.task.title}</span>
                  <ExternalLink className="mt-1 size-3 shrink-0 text-fg-tertiary" />
                </a>
              ) : (
                r.task.title
              )}
            </td>
            {projectNames ? (
              <td className={cn(TD, 'text-fg-secondary')}>
                <Link href={`/projects/${r.task.projectId}/analytics`} className="hover:text-accent">
                  {projectNames[r.task.projectId] ?? '—'}
                </Link>
              </td>
            ) : null}
            <td className={cn(TD, 'whitespace-nowrap', STATUS_TONE[r.task.status])}>{TASK_STATUS_LABELS[r.task.status] ?? r.task.status}</td>
            <td className={cn(TD, 'whitespace-nowrap text-fg-secondary')}>{formatDateIn(r.task.created, tz)}</td>
            <td className={cn(TD, 'whitespace-nowrap text-fg-secondary')}>{formatDuration(r.reactionSeconds)}</td>
            <td className={cn(TD, 'whitespace-nowrap text-fg-secondary')}>{formatDuration(r.resolutionSeconds)}</td>
            <td className={cn(TD, 'whitespace-nowrap')}>
              {r.task.responsibleId ? (
                <Link href={`/analytics/team/${r.task.responsibleId}`} className="hover:text-accent">
                  {names[r.task.responsibleId] ?? r.task.responsibleName ?? '—'}
                </Link>
              ) : (
                '—'
              )}
            </td>
            <td className={cn(TD, 'whitespace-nowrap text-right nums')}>{formatDuration(r.seconds)}</td>
          </tr>
        ))}
      </Table>
      {rows.length > shown.length ? (
        <p className="mt-2 text-xs text-fg-tertiary">Показаны {shown.length} из {rows.length} задач — полный список в выгрузке Excel.</p>
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
        <tr key={`${m.projectId}:${m.id}:${m.start.getTime()}`} className={cn('border-b border-border last:border-0', !held && 'text-fg-tertiary')}>
          <td className={cn(TD, 'whitespace-nowrap')}>{formatDateIn(m.start, tz)}</td>
          <td className={cn(TD, 'whitespace-nowrap')}>
            {formatTimeIn(m.start, tz)}–{formatTimeIn(m.end, tz)}
          </td>
          <td className={TD}>
            {m.title}
            {!held ? <span className="ml-2 font-mono text-[10px] uppercase">запланирована</span> : null}
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
          <td className={cn(TD, 'whitespace-nowrap text-right nums')}>{formatDuration((m.end.getTime() - m.start.getTime()) / 1000)}</td>
        </tr>
      ))}
    </Table>
  );
}

export function TeamTable({ rows, names, query }: { rows: EmployeeRow[]; names: Record<string, string>; query: string }) {
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
        <tr key={r.userId} className="border-b border-border last:border-0">
          <td className={TD}>
            <Link href={`/analytics/team/${r.userId}${query}`} className="font-medium hover:text-accent">
              {names[r.userId] ?? `Сотрудник ${r.userId}`}
            </Link>
          </td>
          <td className={cn(TD, 'text-right font-medium nums')}>{formatHours(r.totalSeconds)} ч</td>
          <td className={cn(TD, 'text-right text-fg-secondary nums')}>{formatHours(r.taskSeconds)} ч</td>
          <td className={cn(TD, 'text-right text-fg-secondary nums')}>
            {formatHours(r.meetingSeconds)} ч · {r.meetings}
          </td>
          <td className={cn(TD, 'text-right nums')}>{r.done}</td>
          <td className={cn(TD, 'text-right nums')}>{r.openNow}</td>
        </tr>
      ))}
    </Table>
  );
}

export function JournalTable({ rows, tz, projectNames }: { rows: JournalRow[]; tz: string; projectNames: Record<string, string> }) {
  return (
    <Table
      empty={rows.length === 0 ? 'Записей времени за период нет' : null}
      head={
        <>
          <th className={TH}>Когда</th>
          <th className={TH}>Задача</th>
          <th className={TH}>Проект</th>
          <th className={TH}>Комментарий</th>
          <th className={cn(TH, 'text-right')}>Время</th>
        </>
      }
    >
      {rows.map((r, i) => (
        <tr key={i} className="border-b border-border last:border-0">
          <td className={cn(TD, 'whitespace-nowrap text-fg-secondary')}>{formatDateTimeIn(r.entry.at, tz)}</td>
          <td className={TD}>{r.task?.title ?? `Задача ${r.entry.taskId}`}</td>
          <td className={cn(TD, 'text-fg-secondary')}>{projectNames[r.projectId] ?? '—'}</td>
          <td className={cn(TD, 'text-fg-tertiary')}>{r.entry.comment || '—'}</td>
          <td className={cn(TD, 'whitespace-nowrap text-right nums')}>{formatDuration(r.entry.seconds)}</td>
        </tr>
      ))}
    </Table>
  );
}
