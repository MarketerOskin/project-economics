import { describe, it, expect } from 'vitest';
import { humanizeAudit } from '@/lib/audit/humanize';

const base = {
  id: 'a1',
  actorName: 'Иван Петров',
  entityType: 'FINANCIAL_ENTRY',
  entityId: 'e1',
  projectId: 'p1',
  before: null as unknown,
  after: null as unknown,
  changedFields: [] as string[],
  createdAt: new Date('2026-05-14T14:32:00Z'),
};

/** Collapse every kind of Unicode space so assertions don't fight ICU's nbsp. */
const n = (s: string | null) => (s ?? '').replace(/\s+/g, ' ');

describe('humanizeAudit (ТЗ §32)', () => {
  it('FINANCE_UPDATED shows a money before → after line', () => {
    const h = humanizeAudit(
      {
        ...base,
        action: 'FINANCE_UPDATED',
        before: { amount: '25000', direction: 'EXPENSE' },
        after: { amount: '32000', direction: 'EXPENSE' },
      },
      'Альфа',
    );
    expect(h.who).toBe('Иван Петров');
    expect(h.sentence).toBe('изменил расход проекта «Альфа»');
    expect(n(h.change)).toBe('25 000 ₽ → 32 000 ₽');
  });

  it('PROJECT_ARCHIVED reads naturally', () => {
    const h = humanizeAudit({ ...base, action: 'PROJECT_ARCHIVED', entityType: 'PROJECT' }, 'Север');
    expect(h.sentence).toBe('отправил проект «Север» в архив');
  });

  it('PROJECT_UPDATED with a name change surfaces old → new', () => {
    const h = humanizeAudit(
      {
        ...base,
        action: 'PROJECT_UPDATED',
        entityType: 'PROJECT',
        changedFields: ['name'],
        before: { name: 'Старое' },
        after: { name: 'Новое' },
      },
      'Новое',
    );
    expect(h.sentence).toContain('название');
    expect(h.change).toBe('Старое → Новое');
  });

  it('FINANCE_DELETED names the amount', () => {
    const h = humanizeAudit(
      { ...base, action: 'FINANCE_DELETED', before: { amount: '25000', direction: 'EXPENSE' } },
      'Альфа',
    );
    expect(n(h.sentence)).toBe('удалил расход 25 000 ₽ по проекту «Альфа»');
  });

  it('an unknown action never throws and returns a safe sentence', () => {
    const h = humanizeAudit({ ...base, action: 'SOMETHING_NEW' as never }, 'Альфа');
    expect(h.sentence).toBeTruthy();
    expect(h.change).toBeNull();
  });

  it('never emits raw JSON', () => {
    const h = humanizeAudit(
      {
        ...base,
        action: 'FINANCE_CREATED',
        after: { amount: '50000', direction: 'INCOME', categoryId: 'c1' },
      },
      'Альфа',
    );
    expect(h.sentence + (h.change ?? '')).not.toMatch(/[{}[\]"]/);
  });
});
