/**
 * The finance engine — the single source of truth for financial formulas (ТЗ §49).
 * Pure functions: Decimal in, Decimal | null out. No DB, no React, no Next imports.
 */
export * from './money';
export * from './types';
export {
  profit,
  margin,
  hoursRateAmount,
  deviation,
  marginDeltaPoints,
} from './calculations';
export {
  aggregateProject,
  aggregateCompany,
  expenseStructure,
  timeSeries,
} from './aggregates';
