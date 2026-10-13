import { describe, it, expect } from 'vitest';
import {
  isFinished,
  NO_RULES,
  OUTCOME_SEMANTIC,
  ruleKey,
  stageSemantic,
  type StageSemantic,
} from '@/domain/crm/stages';

describe('stage rules (ADR-051)', () => {
  it('falls back to Bitrix24 semantics without a rule', () => {
    expect(stageSemantic(NO_RULES, 1044, 'DT1044_55:NEW', 'process')).toBe('process');
  });

  it('a portal rule overrides Bitrix24 for that section only', () => {
    const rules = new Map<string, StageSemantic>([
      [ruleKey(1044, 'DT1044_55:DONE'), OUTCOME_SEMANTIC.CLOSED],
    ]);
    expect(stageSemantic(rules, 1044, 'DT1044_55:DONE', 'process')).toBe('closed');
    expect(stageSemantic(rules, 2, 'DT1044_55:DONE', 'process')).toBe('process');
  });

  it('closed, success and cancelled are finished; in work is not', () => {
    expect(isFinished('closed')).toBe(true);
    expect(isFinished('success')).toBe(true);
    expect(isFinished('fail')).toBe(true);
    expect(isFinished('process')).toBe(false);
    expect(isFinished(undefined)).toBe(false);
  });
});
