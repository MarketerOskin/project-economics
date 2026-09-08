import type { Decimal } from '@/domain/finance/money';
import type { ProjectEconomics } from '@/domain/finance';

const s = (d: Decimal): string => d.toString();
const sn = (d: Decimal | null): string | null => (d === null ? null : d.toString());

export interface EconomicsJson {
  factIncome: string;
  factExpense: string;
  factProfit: string;
  factMargin: string | null;
  planIncome: string;
  planExpense: string;
  planProfit: string;
  planMargin: string | null;
  incomeDeviation: string;
  expenseDeviation: string;
  profitDeviation: string;
  marginDeltaPoints: string | null;
}

/** Decimal -> string, null preserved (the client formats; margins can be null — ТЗ §16). */
export function economicsToJson(e: ProjectEconomics): EconomicsJson {
  return {
    factIncome: s(e.factIncome),
    factExpense: s(e.factExpense),
    factProfit: s(e.factProfit),
    factMargin: sn(e.factMargin),
    planIncome: s(e.planIncome),
    planExpense: s(e.planExpense),
    planProfit: s(e.planProfit),
    planMargin: sn(e.planMargin),
    incomeDeviation: s(e.incomeDeviation),
    expenseDeviation: s(e.expenseDeviation),
    profitDeviation: s(e.profitDeviation),
    marginDeltaPoints: sn(e.marginDeltaPoints),
  };
}
