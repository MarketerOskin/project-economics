/**
 * How a CRM stage counts (ADR-051). Bitrix24 marks stages as success, fail or in progress,
 * but a smart process often keeps "done" work in a stage it calls in progress. The portal
 * says per stage what it means; stages it hasn't set keep the Bitrix24 semantics.
 */

/** «В работе», «Закрыта» (finished, no outcome), «Успешно», «Отменена». */
export type StageSemantic = 'process' | 'closed' | 'success' | 'fail';

export type StageOutcome = 'PROCESS' | 'CLOSED' | 'SUCCESS' | 'CANCELLED';

export const OUTCOME_SEMANTIC: Record<StageOutcome, StageSemantic> = {
  PROCESS: 'process',
  CLOSED: 'closed',
  SUCCESS: 'success',
  CANCELLED: 'fail',
};

export const SEMANTIC_OUTCOME: Record<StageSemantic, StageOutcome> = {
  process: 'PROCESS',
  closed: 'CLOSED',
  success: 'SUCCESS',
  fail: 'CANCELLED',
};

export const OUTCOME_LABELS: Record<StageOutcome, string> = {
  PROCESS: 'В работе',
  CLOSED: 'Закрыта',
  SUCCESS: 'Успешно',
  CANCELLED: 'Отменена',
};

/** Stage rules of a portal: `${entityTypeId}|${stageId}` -> semantic. */
export type StageRules = ReadonlyMap<string, StageSemantic>;

export const NO_RULES: StageRules = new Map();

export function ruleKey(entityTypeId: number, stageId: string): string {
  return `${entityTypeId}|${stageId}`;
}

/** The stage's semantic after the portal's rules. */
export function stageSemantic(
  rules: StageRules,
  entityTypeId: number,
  stageId: string,
  fallback: StageSemantic,
): StageSemantic {
  return rules.get(ruleKey(entityTypeId, stageId)) ?? fallback;
}

/** Finished work: closed, won or cancelled. */
export function isFinished(s: StageSemantic | undefined): boolean {
  return s === 'closed' || s === 'success' || s === 'fail';
}
