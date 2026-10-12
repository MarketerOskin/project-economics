import { analyticsPage, loadProblems, type SearchParams } from '@/server/analytics-page';
import { AnalyticsPeriod } from '@/components/analytics/analytics-period';
import { AnalyticsFilters } from '@/components/analytics/analytics-filters';
import { LoadNotices } from '@/components/analytics/notices';
import { TeamTable } from '@/components/analytics/tables';
import { AnalyticsUpsell, NoBitrixProjects, Section, Toolbar } from '@/components/analytics/page-parts';
import { teamOverview } from '@/domain/analytics';

export const dynamic = 'force-dynamic';

export default async function AnalyticsTeamPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await analyticsPage(searchParams);
  if (!ctx.pro) return <AnalyticsUpsell />;
  const { world, period, names, projectNames, periodQuery } = ctx;

  if (world.projects.length === 0 && !ctx.projectFilter) {
    return (
      <div className="px-4 py-6 sm:px-8">
        <NoBitrixProjects unlinked={world.unlinked} />
      </div>
    );
  }

  // Everyone on the portal's staff list, plus anyone else with activity in the period.
  const staff = new Set(world.staffIds);
  const rows = teamOverview(world.projects, period, world.now, world.staffIds).filter(
    (r) => staff.has(r.userId) || r.totalSeconds > 0 || r.done > 0 || r.openNow > 0,
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <Toolbar>
        <AnalyticsPeriod preset={period.preset} label={period.label} month={period.month} />
        <AnalyticsFilters projects={Object.entries(projectNames).map(([value, label]) => ({ value, label }))} people={[]} />
      </Toolbar>
      <LoadNotices problems={loadProblems(world)} fetchedAt={world.fetchedAt} tz={world.tz} />
      <Section
        title="Нагрузка по сотрудникам"
        hint="Встреча записывается целиком каждому участнику, поэтому сумма по людям может быть больше часов проектов."
      >
        <TeamTable rows={rows} names={names} query={periodQuery} />
      </Section>
    </div>
  );
}
