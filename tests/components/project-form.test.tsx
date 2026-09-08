import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectForm } from '@/components/projects/project-form';
import { ToastProvider } from '@/lib/client/toast';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn(), refresh: vi.fn() }),
}));

const apiFetch = vi.fn();
vi.mock('@/lib/client/api', async (orig) => {
  const actual = await orig<typeof import('@/lib/client/api')>();
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

function setup() {
  return render(
    <ToastProvider>
      <ProjectForm />
    </ToastProvider>,
  );
}

describe('ProjectForm', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    push.mockReset();
    apiFetch.mockImplementation((url: string) =>
      url === '/api/users' ? Promise.resolve({ users: [] }) : Promise.resolve({ id: 'p1' }),
    );
  });

  it('shows a validation error when the name is empty', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Создать проект' }));
    expect(await screen.findByText('Укажите название проекта')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalledWith('/api/projects', expect.anything());
  });

  it('submits a valid project and navigates to it', async () => {
    setup();
    await userEvent.type(screen.getByLabelText('Название'), 'Внедрение CRM');
    await userEvent.click(screen.getByRole('button', { name: 'Создать проект' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/projects',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(push).toHaveBeenCalledWith('/projects/p1');
  });
});
