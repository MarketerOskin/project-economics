import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Nav } from '@/components/layout/nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('Nav role gating (ТЗ §7)', () => {
  it('shows every section for ADMIN', () => {
    render(<Nav role="ADMIN" />);
    for (const label of ['Дашборд', 'Проекты', 'Финансы', 'Автоматизация', 'Продажи по воронкам', 'Статьи', 'История', 'Настройки', 'Как это работает']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('hides Статьи / История / Настройки for EMPLOYEE, but keeps Как это работает', () => {
    render(<Nav role="EMPLOYEE" />);
    expect(screen.getByRole('link', { name: 'Дашборд' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Проекты' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Финансы' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Как это работает' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Автоматизация' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Продажи по воронкам' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Статьи' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'История' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Настройки' })).not.toBeInTheDocument();
  });

  it('MANAGER sees Статьи and История but not Настройки', () => {
    render(<Nav role="MANAGER" />);
    expect(screen.getByRole('link', { name: 'Статьи' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'История' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Настройки' })).not.toBeInTheDocument();
  });
});
