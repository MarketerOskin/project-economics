import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncomeDraftsManager } from '@/components/income-drafts/income-drafts-manager';
import { ToastProvider } from '@/lib/client/toast';

const apiFetch = vi.fn();
vi.mock('@/lib/client/api', async (orig) => {
  const actual = await orig<typeof import('@/lib/client/api')>();
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const draft = {
  id: 'd1',
  projectId: 'p1',
  projectName: 'Внедрение CRM',
  crmAmount: '450000',
  syncedAt: '2026-09-23T10:00:00.000Z',
};

const categories = [{ id: 'c1', kind: 'INCOME', name: 'Оплата по договору', accentColor: 'green', sortOrder: 0, isArchived: false, isSystem: false, usageCount: 0 }] as const;

function setup(initial = [draft]) {
  return render(
    <ToastProvider>
      <IncomeDraftsManager initial={initial} incomeCategories={[...categories]} />
    </ToastProvider>,
  );
}

describe('IncomeDraftsManager (ADR-028)', () => {
  beforeEach(() => apiFetch.mockReset());

  it('shows an empty state with no drafts', () => {
    setup([]);
    expect(screen.getByText('Суммы сделок совпадают с записанным доходом — подтверждать нечего.')).toBeInTheDocument();
  });

  it('blocks approval until a category is picked', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Подтвердить/ }));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(await screen.findByText('Выберите статью дохода')).toBeInTheDocument();
  });

  it('rejects a draft without requiring a category', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Отклонить/ }));
    expect(apiFetch).toHaveBeenCalledWith('/api/income-drafts/d1/reject', { method: 'POST' });
    expect(await screen.findByText('Суммы сделок совпадают с записанным доходом — подтверждать нечего.')).toBeInTheDocument();
  });
});
