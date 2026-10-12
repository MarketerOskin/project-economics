import Link from 'next/link';
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
import { dailySeries, employeeProfile } from '@/domain/analytics';
import { formatDuration, formatHours } from '@/lib/format';
import { cn } from '@/lib/cn';

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

  const profile = employeeProfile(userId, world.projects, period, world.now);
  const s = profile.summary;
  const series = dailySeries(world.projects, period, world.tz, world.now, { employeeId: userId });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <Link href={`/analytics/team${periodQuery}`} className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-accent">
          <ArrowLeft className="size-4" />
          Все сотрудники
        </Link>
        <h2 className="mt-2 text-xl font-bold">{name}</h2>
        {person?.position ? <p className="text-sm text-fg-tertiary">{person.position}</p> : null}
      </div>

      <Toolbar>
        <AnalyticsPeriod preset={period.preset} label={period.label} month={period.month} />
        <ExportButton employeeId={userId} />
      </Toolbar>
      <LoadNotices problems={loadProblems(world)} fetchedAt={world.fetchedAt} tz={world.tz} />

      <StatGrid>
        <Stat label="Часы" value={formatHours(s.totalSeconds)} hint={`задачи ${formatHours(s.taskSeconds)} · встречи ${formatHours(s.meetingSeconds)}`} />
        <Stat label="Выполнено" value={String(s.done)} hint={`новых за период ${s.created}`} />
        <Stat label="Открыто сейчас" value={String(s.openNow)} hint={s.overdue ? `просрочено ${s.overdue}` : undefined} tone={s.overdue ? 'negative' : undefined} />
        <Stat label="Встречи" value={String(s.meetings)} />
        <Stat label="Реакция" value={formatDuration(s.avgReactionSeconds)} hint={`медиана ${formatDuration(s.medianReactionSeconds)}`} />
        <Stat label="Решение" value={formatDuration(s.avgResolutionSeconds)} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Часы по дням">
          <HoursByDayChart data={series} />
        </ChartCard>
        <ChartCard title="По проектам">
          {profile.byProject.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg-tertiary">За период работы по проектам нет</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {profile.byProject.map((p) => {
                const max = profile.byProject[0]!.totalSeconds || 1;
                return (
                  <li key={p.projectId}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <Link href={`/projects/${p.projectId}/analytics${periodQuery}`} className="truncate hover:text-accent">
                        {p.name}
                      </Link>
                      <span className="shrink-0 nums text-fg-secondary">
                        {formatHours(p.totalSeconds)} ч · выполнено {p.done}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-surface-muted">
                      <div className={cn('h-full bg-accent')} style={{ width: `${Math.round((p.totalSeconds / max) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>
      </div>

      <Section title="Задачи">
        <TasksTable rows={profile.tasks} tz={world.tz} names={names} projectNames={projectNames} />
      </Section>
      <Section title="Встречи">
        <MeetingsTable rows={profile.meetings} tz={world.tz} names={names} projectNames={projectNames} />
      </Section>
      <Section title="Журнал времени">
        <JournalTable rows={profile.journal} tz={world.tz} projectNames={projectNames} />
      </Section>
    </div>
  );
}
