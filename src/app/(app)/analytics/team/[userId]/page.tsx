import Link from 'next/link';
import { drillHref } from '@/lib/drill';
import { ArrowLeft } from 'lucide-react';
import { analyticsPage, loadProblems, type SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { ExportButton } from '@/components/analytics/export-button';
import { LoadNotices } from '@/components/analytics/notices';
import { Stat, StatGrid } from '@/components/analytics/stat';
import { HoursByDayChart } from '@/components/analytics/charts';
import { JournalTable, MeetingsTable, TasksTable } from '@/components/analytics/tables';
import { AnalyticsUpsell, Section, Toolbar } from '@/components/analytics/page-parts';
import { ChartCard } from '@/components/charts/chart-card';
import { Donut } from '@/components/analytics/donut';
import { UpcomingMeetingsCard } from '@/components/analytics/overview-parts';
import { dailySeries, employeeProfile, upcomingMeetings } from '@/domain/analytics';
import { formatDuration, formatHours } from '@/lib/format';
import { cn } from '@/lib/cn';

const PROJECT_COLORS = [
  'var(--accent)',
  'var(--cat-blue)',
  'var(--cat-orange)',
  'var(--cat-violet)',
  'var(--cat-cyan)',
  'var(--cat-burgundy)',
];

export const dynamic = 'force-dynamic';

export default async function AnalyticsEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: SearchParams;
}) {
  const { userId } = await params;
  const ctx = await analyticsPage(searchParams);
  if (!ctx.pro) return <AnalyticsUpsell />;
  const { world, period, names, projectNames, periodQuery } = ctx;
  const person = world.people.get(userId);
  const name = names[userId] ?? person?.name ?? `Сотрудник ${userId}`;
  const drill = (path: string, view?: string) =>
    drillHref(path, periodQuery, { view, employeeId: userId });

  const profile = employeeProfile(userId, world.projects, period, world.now);
  const s = profile.summary;
  const series = dailySeries(world.projects, period, world.tz, world.now, { employeeId: userId });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <Link
          href={`/analytics/team${periodQuery}`}
          className="text-fg-secondary hover:text-accent inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          Все сотрудники
        </Link>
        <h2 className="mt-2 text-xl font-bold">{name}</h2>
        {person?.position ? <p className="text-fg-tertiary text-sm">{person.position}</p> : null}
      </div>

      <Toolbar>
        <AnalyticsPeriod preset={period.preset} label={period.label} month={period.month} />
        <ExportButton employeeId={userId} />
      </Toolbar>
      <LoadNotices problems={loadProblems(world)} fetchedAt={world.fetchedAt} tz={world.tz} />

      <StatGrid>
        <Stat
          label="Часы"
          value={formatHours(s.totalSeconds)}
          hint={`задачи ${formatHours(s.taskSeconds)} · встречи ${formatHours(s.meetingSeconds)}`}
          href={drill('/analytics/hours')}
        />
        <Stat
          label="Выполнено"
          value={String(s.done)}
          hint={`новых за период ${s.created}`}
          href={drill('/analytics/tasks', 'done')}
        />
        <Stat
          label="Открыто сейчас"
          value={String(s.openNow)}
          hint={s.overdue ? `просрочено ${s.overdue}` : undefined}
          tone={s.overdue ? 'negative' : undefined}
          href={drill('/analytics/tasks', s.overdue ? 'overdue' : 'open')}
        />
        <Stat
          label="Встречи"
          value={String(s.meetings)}
          hint={`${formatHours(s.meetingSeconds)} ч на встречах`}
          href={drill('/analytics/meetings')}
        />
        <Stat
          label="Реакция"
          value={formatDuration(s.avgReactionSeconds)}
          hint={`медиана ${formatDuration(s.medianReactionSeconds)}`}
          href={drill('/analytics/tasks', 'created')}
        />
        <Stat
          label="Решение"
          value={formatDuration(s.avgResolutionSeconds)}
          href={drill('/analytics/tasks', 'done')}
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Часы по дням">
          <HoursByDayChart data={series} />
        </ChartCard>
        <ChartCard title="Часы по проектам">
          <Donut
            items={profile.byProject.map((p, i) => ({
              key: p.projectId,
              label: p.name,
              value: p.totalSeconds,
              display: `${formatHours(p.totalSeconds)} ч`,
              color: PROJECT_COLORS[i % PROJECT_COLORS.length]!,
            }))}
            center={`${formatHours(s.totalSeconds)} ч`}
            empty="За период работы по проектам нет"
          />
        </ChartCard>
      </div>

      <Section title="Проекты сотрудника">
        <div className="border-border bg-surface overflow-x-auto border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-fg-tertiary border-b text-left font-mono text-[11px] tracking-[0.06em] uppercase">
                <th className="px-3 py-2.5 font-medium">Проект</th>
                <th className="px-3 py-2.5 text-right font-medium">Часы задач</th>
                <th className="px-3 py-2.5 text-right font-medium">Часы встреч</th>
                <th className="px-3 py-2.5 text-right font-medium">Всего</th>
                <th className="px-3 py-2.5 text-right font-medium">Закрыто задач</th>
              </tr>
            </thead>
            <tbody>
              {profile.byProject.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-fg-tertiary px-3 py-6 text-center">
                    За период работы по проектам нет
                  </td>
                </tr>
              ) : (
                profile.byProject.map((p) => (
                  <tr key={p.projectId} className="border-border border-b last:border-0">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/projects/${p.projectId}/analytics${periodQuery}`}
                        className="text-accent font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="nums px-3 py-2.5 text-right">{formatHours(p.taskSeconds)} ч</td>
                    <td className="nums px-3 py-2.5 text-right">
                      {formatHours(p.meetingSeconds)} ч
                    </td>
                    <td className="nums px-3 py-2.5 text-right font-medium">
                      {formatHours(p.totalSeconds)} ч
                    </td>
                    <td className="nums px-3 py-2.5 text-right">{p.done}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <UpcomingMeetingsCard
        meetings={upcomingMeetings(
          world.projects.flatMap((p) => p.meetings),
          world.now,
          30,
          userId,
        )}
        tz={world.tz}
        projectNames={projectNames}
      />

      <Section title="Задачи">
        <TasksTable rows={profile.tasks} tz={world.tz} names={names} projectNames={projectNames} />
      </Section>
      <Section title="Встречи">
        <MeetingsTable
          rows={profile.meetings}
          tz={world.tz}
          names={names}
          projectNames={projectNames}
        />
      </Section>
      <Section title="Журнал времени">
        <JournalTable rows={profile.journal} tz={world.tz} projectNames={projectNames} />
      </Section>
    </div>
  );
}
