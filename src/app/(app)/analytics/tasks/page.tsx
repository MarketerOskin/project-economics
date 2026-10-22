import Link from 'next/link';
import { analyticsPage, loadProblems, type SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { LoadNotices } from '@/components/analytics/notices';
import { AnalyticsUpsell, Toolbar } from '@/components/analytics/page-parts';
import { TasksTable } from '@/components/analytics/tables';
import {
  statusKeyLabel,
  TASK_VIEW_LABELS,
  drillTasks,
  type TaskView,
} from '@/domain/analytics';
import { drillHref } from '@/lib/drill';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

const VIEWS: TaskView[] = ['all', 'touched', 'created', 'done', 'open', 'overdue', 'worked'];

/** The tasks behind an analytics figure (ADR-049); each opens its card, then Bitrix24. */
export default async function AnalyticsTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await analyticsPage(searchParams);
  if (!ctx.pro) return <AnalyticsUpsell />;
  const { world, period, filters, names, projectNames, periodQuery, projectFilter } = ctx;
  const sp = await searchParams;
  const raw = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const view: TaskView = VIEWS.includes(raw as TaskView) ? (raw as TaskView) : 'all';
  const status = (Array.isArray(sp.status) ? sp.status[0] : sp.status) || undefined;
  const f = { ...filters, status };

  const tasks = world.projects.flatMap((p) => p.tasks);
  const entries = world.projects.flatMap((p) => p.entries);
  const rows = drillTasks(tasks, entries, period, world.now, view, f);
  const counts = Object.fromEntries(
    VIEWS.map((v) => [v, drillTasks(tasks, entries, period, world.now, v, f).length]),
  );
  const keep = { projectId: projectFilter, employeeId: filters.employeeId, status };
  const scopeLabel = [
    projectFilter ? projectNames[projectFilter] : null,
    filters.employeeId ? (names[filters.employeeId] ?? `Сотрудник ${filters.employeeId}`) : null,
    status ? `статус «${statusKeyLabel(status)}»` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5 px-4 py-6 sm:px-8">
      <Toolbar>
        <AnalyticsPeriod preset={period.preset} label={period.label} month={period.month} />
        <Link
          href={drillHref('/analytics', periodQuery, {
            projectId: projectFilter,
            employeeId: filters.employeeId,
          })}
          className="text-accent text-sm hover:underline"
        >
          ← К обзору
        </Link>
      </Toolbar>
      <LoadNotices problems={loadProblems(world)} fetchedAt={world.fetchedAt} tz={world.tz} />

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={drillHref('/analytics/tasks', periodQuery, {
              ...keep,
              view: v === 'all' ? undefined : v,
            })}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              v === view
                ? 'border-accent bg-accent text-accent-fg font-medium'
                : 'border-border bg-surface text-fg-secondary hover:border-accent hover:text-accent',
            )}
          >
            {TASK_VIEW_LABELS[v]} · {counts[v]}
          </Link>
        ))}
      </div>
      {scopeLabel.length ? (
        <p className="text-fg-secondary text-sm">Только: {scopeLabel.join(', ')}</p>
      ) : null}

      <TasksTable
        rows={rows}
        tz={world.tz}
        names={names}
        projectNames={projectNames}
        limit={1000}
      />
    </div>
  );
}
