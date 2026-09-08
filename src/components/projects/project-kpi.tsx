import { KpiCard } from '@/components/kpi/kpi-card';
import type { EconomicsJson } from '@/server/serialize';

export function ProjectKpi({ e }: { e: EconomicsJson }) {
  return (
    <div className="grid gap-4 px-4 sm:px-8 py-5 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Доход" factValue={e.factIncome} planValue={e.planIncome} deviation={e.incomeDeviation} />
      <KpiCard label="Расход" factValue={e.factExpense} planValue={e.planExpense} deviation={e.expenseDeviation} />
      <KpiCard label="Прибыль" factValue={e.factProfit} planValue={e.planProfit} deviation={e.profitDeviation} />
      <KpiCard
        label="Рентабельность"
        factValue={e.factMargin ?? '0'}
        planValue={e.planMargin ?? '0'}
        percent
        points={e.marginDeltaPoints}
      />
    </div>
  );
}
