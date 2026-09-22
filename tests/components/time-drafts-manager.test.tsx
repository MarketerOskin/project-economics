import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeDraftsManager } from '@/components/time-drafts/time-drafts-manager';
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
  employeeId: 'u1',
  employeeName: 'Иван Иванов',
  hourlyRate: '1000',
  workDate: '2026-09-10',
  hours: '2',
  amount: '2000',
};

const categories = [{ id: 'c1', kind: 'EXPENSE', name: 'Оплата труда', accentColor: 'blue', sortOrder: 0, isArchived: false, isSystem: false, usageCount: 0 }] as const;

function setup(initial = [draft]) {
  return render(
    <ToastProvider>
      <TimeDraftsManager initial={initial} expenseCategories={[...categories]} />
    </ToastProvider>,
  );
}

describe('TimeDraftsManager (ADR-027)', () => {
  beforeEach(() => apiFetch.mockReset());

  it('shows an empty state with no drafts', () => {
    setup([]);
    expect(screen.getByText('Нет часов, ожидающих подтверждения.')).toBeInTheDocument();
  });

  it('blocks approval until a category is picked', async () => {
    setup();

    await userEvent.click(screen.getByRole('button', { name: /Подтвердить/ }));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(await screen.findByText('Выберите статью расхода')).toBeInTheDocument();
  });

  it('rejects a draft without requiring a category', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });
    setup();

    await userEvent.click(screen.getByRole('button', { name: /Отклонить/ }));

    expect(apiFetch).toHaveBeenCalledWith('/api/time-drafts/d1/reject', { method: 'POST' });
    expect(await screen.findByText('Нет часов, ожидающих подтверждения.')).toBeInTheDocument();
  });
});
