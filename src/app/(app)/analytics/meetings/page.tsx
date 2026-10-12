import { analyticsPage, loadProblems, type SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import { LoadNotices } from '@/components/analytics/notices';
import { Stat } from '@/components/analytics/stat';
import { MeetingsTable } from '@/components/analytics/tables';
import { AnalyticsUpsell, NoBitrixProjects, Section, Toolbar } from '@/components/analytics/page-parts';
import { meetingRows, meetingSeconds } from '@/domain/analytics';
import { formatHours } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AnalyticsMeetingsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await analyticsPage(searchParams);
  if (!ctx.pro) return <AnalyticsUpsell />;
  const { world, period, filters, names, projectNames } = ctx;

  if (world.projects.length === 0 && !ctx.projectFilter) {
    return (
      <div className="px-4 py-6 sm:px-8">
        <NoBitrixProjects unlinked={world.unlinked} />
      </div>
    );
  }

  const rows = meetingRows(world.projects.flatMap((p) => p.meetings), period, world.now, filters.employeeId);
  const heldRows = rows.filter((r) => r.held);
  const heldSeconds = heldRows.reduce((a, r) => a + meetingSeconds(r.meeting), 0);
  const groupsOnly = world.projects.every((p) => p.sourceKind !== 'crm');

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <Toolbar>
        <AnalyticsPeriod preset={period.preset} label={period.label} month={period.month} />
        <AnalyticsFilters
          projects={Object.entries(projectNames).map(([value, label]) => ({ value, label }))}
          people={Object.entries(names).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))}
        />
      </Toolbar>
      <LoadNotices problems={loadProblems(world)} fetchedAt={world.fetchedAt} tz={world.tz} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Прошло встреч" value={String(heldRows.length)} />
        <Stat label="Часы встреч" value={formatHours(heldSeconds)} hint="входят в часы проектов" />
        <Stat label="Запланировано" value={String(rows.length - heldRows.length)} />
      </div>

      <Section
        title="Встречи"
        hint={
          groupsOnly
            ? 'Из календарей проектов Битрикс24. Встреча идёт в часы проекта один раз, а в загрузку — каждому участнику.'
            : 'Из календарей проектов Битрикс24. У проектов из CRM календаря нет, их встречи здесь не видны.'
        }
      >
        <MeetingsTable rows={rows} tz={world.tz} names={names} projectNames={projectNames} />
      </Section>
    </div>
  );
}
