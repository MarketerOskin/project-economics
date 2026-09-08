import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { KpiCard } from '@/components/kpi/kpi-card';
import { ChartCard } from '@/components/charts/chart-card';
import { IncomeExpenseChart } from '@/components/charts/income-expense-chart';
import { ProjectProfitChart } from '@/components/charts/project-profit-chart';
import { ExpenseStructureChart } from '@/components/charts/expense-structure-chart';
import { PeriodPicker } from '@/components/dashboard/period-picker';
import { DashboardProjectsTable } from '@/components/dashboard/dashboard-projects-table';
import { EntryFormDialog } from '@/components/finance/entry-form-dialog';
import { requirePageSession } from '@/server/page-session';
import { loadDashboard } from '@/server/services/dashboard';
import { resolvePeriod, type PeriodPreset } from '@/lib/period';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, scope } = await requirePageSession();
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const preset = (get('preset') ?? 'this_year') as PeriodPreset;
  const period = resolvePeriod(preset, {
    from: get('from') ? new Date(get('from')!) : undefined,
    to: get('to') ? new Date(get('to')!) : undefined,
  });

  const data = await loadDashboard(scope, session.actor, {
    from: period.from,
    to: period.to,
    projectId: get('projectId'),
    status: get('status') as 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'ALL' | undefined,
    employeeId: get('employeeId'),
    categoryId: get('categoryId'),
  });

  const canMutateFinance = can.mutateFinance(session.actor);
  const canCreateProject = can.mutateProject(session.actor);
  const hasData = data.projects.length > 0;

  return (
    <>
      <PageHeader
        title="Экономика проектов"
        subtitle="Доходы, расходы и рентабельность проектов"
        actions={
          <>
            <PeriodPicker />
            {canMutateFinance ? <EntryFormDialog /> : null}
            {canCreateProject ? (
              <Button asChild variant="secondary">
                <Link href="/projects/new">
                  <Plus className="size-4" />
                  Новый проект
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-6 px-8 py-6">
        {!hasData ? (
          <EmptyState
            title="Нет данных за период"
            description={
              canCreateProject
                ? 'Создайте проект и добавьте первые операции, либо расширьте период.'
                : 'По доступным вам проектам за этот период операций нет.'
            }
            actions={
              canCreateProject ? (
                <Button asChild>
                  <Link href="/projects/new">Создать проект</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Доходы" factValue={data.kpi.factIncome} planValue={data.kpi.planIncome} deviation={data.kpi.incomeDeviation} />
              <KpiCard label="Расходы" factValue={data.kpi.factExpense} planValue={data.kpi.planExpense} deviation={data.kpi.expenseDeviation} />
              <KpiCard label="Прибыль" factValue={data.kpi.factProfit} planValue={data.kpi.planProfit} deviation={data.kpi.profitDeviation} />
              <KpiCard label="Рентабельность" factValue={data.kpi.factMargin ?? '0'} planValue={data.kpi.planMargin ?? '0'} percent points={data.kpi.marginDeltaPoints} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Доходы и расходы во времени" hint="Факт — сплошная линия, план — пунктир">
                <IncomeExpenseChart data={data.timeseries} showPlan />
              </ChartCard>
              <ChartCard title="Структура расходов" hint="Факт за выбранный период">
                <ExpenseStructureChart data={data.expenseStructure} />
              </ChartCard>
            </div>

            <ChartCard title="Прибыль по проектам" hint="Клик по столбцу открывает проект">
              <ProjectProfitChart data={data.projectBars} />
            </ChartCard>

            <div>
              <h2 className="mb-3 text-sm font-medium text-fg-secondary">Проекты за период</h2>
              <DashboardProjectsTable projects={data.projects} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
