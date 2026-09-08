import Link from 'next/link';
import { requirePageSession } from '@/server/page-session';
import { getProjectDetail } from '@/server/services/project-read';
import { loadDashboard } from '@/server/services/dashboard';
import { queryEntries } from '@/server/services/finance-read';
import { ChartCard } from '@/components/charts/chart-card';
import { IncomeExpenseChart } from '@/components/charts/income-expense-chart';
import { ExpenseStructureChart } from '@/components/charts/expense-structure-chart';
import { EntriesTable } from '@/components/finance/entries-table';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, scope } = await requirePageSession();
  const { id } = await params;

  const [project, dash, recent] = await Promise.all([
    getProjectDetail(scope, session.actor, id),
    loadDashboard(scope, session.actor, { projectId: id, status: 'ALL' }),
    queryEntries(scope, session.actor, {
      projectId: id,
      sort: 'date',
      dir: 'desc',
      page: 1,
      pageSize: 5,
      includeDeleted: false,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 sm:px-8 py-6">
      {project.description ? (
        <p className="max-w-3xl text-sm text-fg-secondary">{project.description}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Динамика" hint="Доходы и расходы по месяцам">
          <IncomeExpenseChart data={dash.timeseries} showPlan />
        </ChartCard>
        <ChartCard title="Структура расходов">
          <ExpenseStructureChart data={dash.expenseStructure} />
        </ChartCard>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-fg-secondary">Последние операции</h2>
          <Link href={`/projects/${id}/finance`} className="text-sm text-accent hover:underline">
            Все операции
          </Link>
        </div>
        {recent.rows.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-border py-8 text-center text-sm text-fg-tertiary">
            Операций пока нет
          </p>
        ) : (
          <EntriesTable rows={recent.rows} canMutate={can.mutateFinance(session.actor)} showProject={false} />
        )}
      </div>
    </div>
  );
}
