import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Nav, NavFooter } from '@/components/layout/nav';
import { homePath } from '@/lib/sections';

vi.mock('next/navigation', () => ({ usePathname: () => '/analytics' }));

describe('Nav (ТЗ §7, ADR-049)', () => {
  it('ADMIN: analytics first, then marketing and sales, projects, finance', () => {
    const { container } = render(<Nav role="ADMIN" />);
    const labels = within(container)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(labels).toEqual([
      'Аналитика',
      'Маркетинг и продажи',
      'Проекты',
      'Финансы',
      'Настройки',
      'Как это работает',
      'Заявка на внедрение',
    ]);
  });

  it('«Статьи» live in settings, history and plans at the bottom', () => {
    render(<Nav role="ADMIN" />);
    expect(screen.queryByRole('link', { name: 'Статьи' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'История' })).not.toBeInTheDocument();
    render(<NavFooter role="MANAGER" />);
    expect(screen.getByRole('link', { name: 'История' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Тарифы' })).toHaveClass('text-accent');
  });

  it('EMPLOYEE: no analytics, marketing, settings, history', () => {
    render(<Nav role="EMPLOYEE" />);
    expect(screen.getByRole('link', { name: 'Проекты' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Финансы' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Как это работает' })).toBeInTheDocument();
    for (const label of ['Аналитика', 'Маркетинг и продажи', 'Настройки']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
    const { container } = render(<NavFooter role="EMPLOYEE" />);
    expect(within(container).queryAllByRole('link')).toHaveLength(0);
  });

  it('marks the current section', () => {
    render(<Nav role="ADMIN" />);
    expect(screen.getByRole('link', { name: 'Аналитика' })).toHaveAttribute('aria-current', 'page');
  });

  it('hides the sections the portal switched off (ADR-041)', () => {
    render(<Nav role="ADMIN" disabled={['analytics']} />);
    expect(screen.queryByRole('link', { name: 'Аналитика' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Маркетинг и продажи' })).toBeInTheDocument();
    render(<NavFooter role="ADMIN" disabled={['history']} />);
    expect(screen.queryByRole('link', { name: 'История' })).not.toBeInTheDocument();
  });

  it('the main screen is analytics, falling back to marketing, then the finance overview', () => {
    expect(homePath('ADMIN', [])).toBe('/analytics');
    expect(homePath('MANAGER', ['analytics'])).toBe('/marketing');
    expect(homePath('MANAGER', ['analytics', 'sales'])).toBe('/finance/overview');
    expect(homePath('EMPLOYEE', [])).toBe('/finance/overview');
  });
});
