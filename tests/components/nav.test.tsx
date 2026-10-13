import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Nav } from '@/components/layout/nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('Nav role gating (ТЗ §7)', () => {
  it('shows every section for ADMIN', () => {
    render(<Nav role="ADMIN" />);
    for (const label of ['Дашборд', 'Проекты', 'Финансы', 'Продажи и обращения', 'Статьи', 'История', 'Настройки', 'Как это работает']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('hides Статьи / История / Настройки for EMPLOYEE, but keeps Как это работает', () => {
    render(<Nav role="EMPLOYEE" />);
    expect(screen.getByRole('link', { name: 'Дашборд' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Проекты' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Финансы' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Как это работает' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Продажи и обращения' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Статьи' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'История' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Настройки' })).not.toBeInTheDocument();
  });

  it('MANAGER sees Статьи, История and Настройки (for «Авторасчёт финансов», ADR-045)', () => {
    render(<Nav role="MANAGER" />);
    expect(screen.getByRole('link', { name: 'Статьи' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'История' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Настройки' })).toBeInTheDocument();
  });

  it('«Автоматизация» lives in settings now, not in the menu', () => {
    render(<Nav role="ADMIN" />);
    expect(screen.queryByRole('link', { name: 'Автоматизация' })).not.toBeInTheDocument();
  });

  it('hides the sections the portal switched off (ADR-041)', () => {
    render(<Nav role="ADMIN" disabled={['analytics', 'history']} />);
    expect(screen.queryByRole('link', { name: 'Аналитика' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'История' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Продажи и обращения' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Финансы' })).toBeInTheDocument();
  });
});
