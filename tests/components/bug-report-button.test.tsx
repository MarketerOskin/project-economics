import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BugReportButton } from '@/components/support/bug-report-button';
import { ToastProvider } from '@/lib/client/toast';

const apiFetch = vi.fn();
vi.mock('@/lib/client/api', async (orig) => {
  const actual = await orig<typeof import('@/lib/client/api')>();
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

function setup() {
  return render(
    <ToastProvider>
      <BugReportButton />
    </ToastProvider>,
  );
}

describe('BugReportButton (reports straight into the developer\'s CRM)', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({ ok: true });
  });

  it('opens the dialog, submits the description, and closes on success', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Сообщить о проблеме' }));
    expect(screen.getByRole('heading', { name: 'Сообщить о проблеме' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Описание'), 'Кнопка «Сохранить» не реагирует на клик');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/support/bug-report',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ description: 'Кнопка «Сохранить» не реагирует на клик' }),
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Сообщить о проблеме' })).not.toBeInTheDocument(),
    );
  });

  it('shows the server error and keeps the dialog open on failure', async () => {
    const { ApiError } = await import('@/lib/client/api');
    apiFetch.mockRejectedValue(new ApiError(502, 'UPSTREAM', 'Отправка отчётов временно недоступна.'));

    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Сообщить о проблеме' }));
    await userEvent.type(screen.getByLabelText('Описание'), 'Дашборд не загружается');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByText('Отправка отчётов временно недоступна.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сообщить о проблеме' })).toBeInTheDocument();
  });
});
