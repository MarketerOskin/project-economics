import Link from 'next/link';
import { analyticsPage, loadProblems, type SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { LoadNotices } from '@/components/analytics/notices';
import { AnalyticsUpsell, Section, Toolbar } from '@/components/analytics/page-parts';
import { Stat, StatGrid } from '@/components/analytics/stat';
import { JournalTable, MeetingsTable } from '@/components/analytics/tables';
import { journalRows, meetingRows, summarizeAll } from '@/domain/analytics';
import { formatHours } from '@/lib/format';
import { drillHref } from '@/lib/drill';

export const dynamic = 'force-dynamic';

/** What «Часы» is made of (ADR-049): every time record of the period and the meetings held. */
export default async function AnalyticsHoursPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await analyticsPage(searchParams);
  if (!ctx.pro) return <AnalyticsUpsell />;
  const { world, period, filters, names, projectNames, periodQuery, projectFilter } = ctx;
  const projects = world.projects;
  const s = summarizeAll(projects, period, world.now, filters);
  const journal = journalRows(
    projects.flatMap((p) => p.tasks),
    projects.flatMap((p) => p.entries),
    period,
    filters,
  );
  const meetings = meetingRows(
    projects.flatMap((p) => p.meetings),
    period,
    world.now,
    filters.employeeId,
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
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
      <StatGrid>
        <Stat label="Всего часов" value={formatHours(s.totalSeconds)} />
        <Stat
          label="В задачах"
          value={formatHours(s.taskSeconds)}
          hint={`${journal.length} записей`}
        />
        <Stat
          label="На встречах"
          value={formatHours(s.meetingSeconds)}
          hint={`${s.meetings} встреч`}
        />
      </StatGrid>
      <Section
        title="Записи времени"
        hint="Название задачи открывает её карточку, стрелка — задачу в Битрикс24"
      >
        <JournalTable rows={journal} tz={world.tz} projectNames={projectNames} names={names} />
      </Section>
      <Section title="Встречи">
        <MeetingsTable rows={meetings} tz={world.tz} names={names} projectNames={projectNames} />
      </Section>
    </div>
  );
}
