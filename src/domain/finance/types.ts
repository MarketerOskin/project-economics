import type { BudgetType, CalculationMode, FinanceDirection } from '@prisma/client';
import type { Decimal } from './money';

/**
 * The minimal shape the finance engine needs from a financial entry. Route handlers
 * load rows via `withPortal` and map them to this — the engine never touches Prisma.
 */
export interface EntryInput {
  direction: FinanceDirection;
  budgetType: BudgetType;
  amount: Decimal;
  categoryId: string;
  operationDate: Date;
  /** Non-null => soft-deleted => excluded from every aggregate (ТЗ §31). */
  deletedAt: Date | null;
}

export interface HoursRateInput {
  calculationMode: CalculationMode;
  hours: Decimal | null;
  hourlyRate: Decimal | null;
}

/**
 * Full economic picture of a project (or the company, as a sum of projects) for a period.
 * Margins are `null` when the corresponding income is zero (ТЗ §16). Deltas of two
 * margins are in percentage points, not percent.
 */
export interface ProjectEconomics {
  factIncome: Decimal;
  factExpense: Decimal;
  factProfit: Decimal;
  factMargin: Decimal | null;

  planIncome: Decimal;
  planExpense: Decimal;
  planProfit: Decimal;
  planMargin: Decimal | null;

  incomeDeviation: Decimal;
  expenseDeviation: Decimal;
  profitDeviation: Decimal;
  /** FACT margin − PLAN margin, in percentage points; null if either margin is null. */
  marginDeltaPoints: Decimal | null;
}

export interface CategoryAmount {
  categoryId: string;
  amount: Decimal;
}

export type TimeGranularity = 'day' | 'week' | 'month';

export interface TimeSeriesPoint {
  /** ISO date of the bucket start (YYYY-MM-DD). */
  bucket: string;
  factIncome: Decimal;
  factExpense: Decimal;
  planIncome: Decimal;
  planExpense: Decimal;
}
