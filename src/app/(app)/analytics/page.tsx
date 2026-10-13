import { analyticsPage, loadProblems, type SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import { ExportButton } from '@/components/analytics/export-button';
import { LoadNotices } from '@/components/analytics/notices';
import { Stat, StatGrid } from '@/components/analytics/stat';
import { HoursByDayChart, TaskFlowChart } from '@/components/analytics/charts';
import { UsageCards, type UsageCardData } from '@/components/analytics/usage';
import { TasksTable } from '@/components/analytics/tables';
import { AnalyticsUpsell, NoBitrixProjects, Section, Toolbar, UnlinkedProjects } from '@/components/analytics/page-parts';
import { ChartCard } from '@/components/charts/chart-card';
import { PeopleCards, SectionHead, SourcesCard, StatusesCard, UpcomingMeetingsCard } from '@/components/analytics/overview-parts';
import {
  dailySeries,
  hoursBySource,
  monthUsage,
  statusSplit,
  summarizeAll,
  summarizeProject,
  taskRows,
  teamOverview,
  upcomingMeetings,
} from '@/domain/analytics';
import { formatDuration, formatHours } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AnalyticsOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await analyticsPage(searchParams);
  if (!ctx.pro) return <AnalyticsUpsell />;
  const { world, period, filters, names, projectNames, periodQuery } = ctx;
  const { tz, now, projects } = world;

  const toolbar = (
    <Toolbar>
      <AnalyticsPeriod preset={period.preset} label={period.label} month={period.month} />
      <div className="flex items-center gap-2">
        <AnalyticsFilters
          projects={Object.entries(projectNames).map(([value, label]) => ({ value, label }))}
          people={Object.entries(names).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))}
        />
        <ExportButton />
      </div>
    </Toolbar>
  );

  if (projects.length === 0 && !ctx.projectFilter) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
        <NoBitrixProjects unlinked={world.unlinked} />
      </div>
    );
  }

  const s = summarizeAll(projects, period, now, filters);
  const series = dailySeries(projects, period, tz, now, filters);
  const cards: UsageCardData[] = projects
    .map((p) => {
      const ps = summarizeProject(p, period, now, filters);
      const usage = monthUsage(p, period, tz, now);
      return {
        projectId: p.projectId,
        name: p.name,
        clientName: p.clientName,
        totalSeconds: ps.totalSeconds,
        taskSeconds: ps.taskSeconds,
        meetingSeconds: ps.meetingSeconds,
        limitSeconds: p.limitHours !== null ? usage.reduce((a, u) => a + (u.limitSeconds ?? 0), 0) : null,
        overageSeconds: usage.reduce((a, u) => a + u.overageSeconds, 0),
        done: ps.done,
        openNow: ps.openNow,
      };
    })
    .sort((a, b) => b.overageSeconds - a.overageSeconds || b.totalSeconds - a.totalSeconds);
  const rows = taskRows(projects.flatMap((p) => p.tasks), projects.flatMap((p) => p.entries), period, filters);
  const overLimit = cards.filter((c) => c.overageSeconds > 0).length;
  const staff = new Set(world.staffIds);
  const team = teamOverview(projects, period, now, world.staffIds).filter(
    (r) => (!filters.employeeId || r.userId === filters.employeeId) && (staff.has(r.userId) || r.totalSeconds > 0),
  );
  const people = Object.fromEntries(
    team.map((r) => {
      const p = world.people.get(r.userId);
      return [r.userId, { name: names[r.userId] ?? p?.name ?? `Сотрудник ${r.userId}`, position: p?.position ?? null, photoUrl: p?.photoUrl ?? null }];
    }),
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      {toolbar}
      <LoadNotices problems={loadProblems(world)} fetchedAt={world.fetchedAt} tz={tz} />

      <StatGrid>
        <Stat label="Создано задач" value={String(s.created)} />
        <Stat label="Выполнено" value={String(s.done)} />
        <Stat label="Открыто сейчас" value={String(s.openNow)} hint={s.overdue ? `просрочено ${s.overdue}` : undefined} tone={s.overdue ? 'negative' : undefined} />
        <Stat label="Реакция" value={formatDuration(s.avgReactionSeconds)} hint={`медиана ${formatDuration(s.medianReactionSeconds)}`} />
        <Stat label="Решение" value={formatDuration(s.avgResolutionSeconds)} hint="в среднем от создания" />
        <Stat
          label="Часы"
          value={formatHours(s.totalSeconds)}
          hint={`задачи ${formatHours(s.taskSeconds)} · встречи ${formatHours(s.meetingSeconds)}`}
        />
        <Stat label="Встреч" value={String(s.meetings)} hint="состоялось за период" />
        <Stat label="Проектов выше лимита" value={String(overLimit)} tone={overLimit ? 'negative' : undefined} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Часы по дням" hint="Записи времени в задачах и прошедшие встречи">
          <HoursByDayChart data={series} />
        </ChartCard>
        <ChartCard title="Задачи по дням" hint="Созданные и выполненные">
          <TaskFlowChart data={series} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SourcesCard slices={hoursBySource(projects, period, now, filters)} />
        <StatusesCard slices={statusSplit(projects.flatMap((p) => p.tasks), period, filters)} />
        <UpcomingMeetingsCard
          meetings={upcomingMeetings(projects.flatMap((p) => p.meetings), now, 30, filters.employeeId)}
          tz={tz}
          projectNames={projectNames}
          allHref={`/analytics/meetings${periodQuery}`}
        />
      </div>

      <Section title="Часы по проектам" hint="Пакет часов задаётся на вкладке «Аналитика» проекта. Красным — сверх пакета.">
        <div className="flex flex-col gap-3">
          <UsageCards items={cards} query={periodQuery} />
          {ctx.projectFilter ? null : <UnlinkedProjects items={world.unlinked} compact />}
        </div>
      </Section>

 <section>
        <SectionHead title="Сотрудники" href={`/analytics/team${periodQuery}`} linkLabel="Вся команда" />
        <PeopleCards rows={team} people={people} query={periodQuery} limit={8} />
      </section>

      <Section title="Задачи за период" hint="Созданные, закрытые или с записями времени в периоде">
        <TasksTable rows={rows} tz={tz} names={names} projectNames={projectNames} />
      </Section>
    </div>
  );
}
