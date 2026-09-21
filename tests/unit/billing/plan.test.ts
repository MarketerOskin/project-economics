import { describe, it, expect } from 'vitest';
import { effectivePlan, requirePro } from '@/lib/billing/plan';

describe('effectivePlan', () => {
  it('FREE stays FREE regardless of expiry', () => {
    expect(effectivePlan({ plan: 'FREE', planExpiresAt: null })).toBe('FREE');
  });

  it('PRO with no expiry stays PRO (unlimited grant)', () => {
    expect(effectivePlan({ plan: 'PRO', planExpiresAt: null })).toBe('PRO');
  });

  it('PRO with a future expiry stays PRO', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(effectivePlan({ plan: 'PRO', planExpiresAt: future })).toBe('PRO');
  });

  it('PRO with a past expiry reverts to FREE', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(effectivePlan({ plan: 'PRO', planExpiresAt: past })).toBe('FREE');
  });
});

describe('requirePro', () => {
  it('does not throw for PRO', () => {
    expect(() => requirePro('PRO', 'Импорт из CRM')).not.toThrow();
  });

  it('throws a 403 AppError for FREE, message names the feature', () => {
    try {
      requirePro('FREE', 'Импорт из CRM');
      expect.unreachable();
    } catch (err) {
      expect((err as { httpStatus: number }).httpStatus).toBe(403);
      expect((err as Error).message).toContain('Импорт из CRM');
    }
  });
});
