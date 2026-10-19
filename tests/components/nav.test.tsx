import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Nav, NavFooter, sectionLabel, sectionTabs } from '@/components/layout/nav';
import { homePath } from '@/lib/sections';

vi.mock('next/navigation', () => ({ usePathname: () => '/analytics' }));

describe('Nav (ТЗ §7, ADR-049)', () => {
  it('ADMIN: analytics first, then marketing and sales, projects, finance', () => {
    const { container } = render(<Nav role="ADMIN" />);
    // Section cards only; the open section (Аналитика) also lists its screens.
    const labels = Array.from(container.querySelectorAll('a[data-nav-section]')).map(
      (a) => a.textContent,
    );
    expect(labels).toEqual(['Аналитика', 'Маркетинг и продажи', 'Проекты', 'Финансы', 'Настройки']);
  });

  it('history and plans belong to settings, help and the request sit under «Ещё» (ADR-064)', () => {
    render(<Nav role="ADMIN" />);
    expect(screen.queryByRole('link', { name: 'Статьи' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'История изменений' })).not.toBeInTheDocument();
    const { container } = render(<NavFooter role="MANAGER" />);
    expect(
      Array.from(container.querySelectorAll('a[data-nav-section]')).map((a) => a.textContent),
    ).toEqual(['Ещё']);
    expect(sectionTabs('/history', 'ADMIN').tabs.map((t) => t.label)).toEqual([
      'Основные',
      'Стадии CRM',
      'История изменений',
      'Тарифы',
    ]);
    expect(sectionTabs('/history', 'ADMIN').active).toBe('/history');
    expect(sectionLabel('/pricing')).toBe('Настройки');
    expect(sectionLabel('/implementation')).toBe('Заявка на внедрение');
  });

  it('EMPLOYEE: no analytics, marketing, settings, history', () => {
    render(<Nav role="EMPLOYEE" />);
    expect(screen.getByRole('link', { name: 'Проекты' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Финансы' })).toBeInTheDocument();
    for (const label of ['Аналитика', 'Маркетинг и продажи', 'Настройки']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
    const { container } = render(<NavFooter role="EMPLOYEE" />);
    expect(within(container).getByRole('link', { name: 'Ещё' })).toBeInTheDocument();
    expect(sectionTabs('/projects', 'EMPLOYEE').tabs).toEqual([]);
  });

  it('marks the current section and lists its screens', () => {
    render(<Nav role="ADMIN" />);
    expect(screen.getByRole('link', { name: 'Аналитика' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Обзор' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Сотрудники' })).toHaveAttribute(
      'href',
      '/analytics/team',
    );
    expect(screen.queryByRole('link', { name: 'Операции' })).not.toBeInTheDocument();
  });

  it('hides the sections the portal switched off (ADR-041)', () => {
    render(<Nav role="ADMIN" disabled={['analytics']} />);
    expect(screen.queryByRole('link', { name: 'Аналитика' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Маркетинг и продажи' })).toBeInTheDocument();
    expect(sectionTabs('/settings', 'ADMIN', ['history']).tabs.map((t) => t.label)).not.toContain(
      'История изменений',
    );
  });

  it('the main screen is analytics, falling back to marketing, then the finance overview', () => {
    expect(homePath('ADMIN', [])).toBe('/analytics');
    expect(homePath('MANAGER', ['analytics'])).toBe('/marketing');
    expect(homePath('MANAGER', ['analytics', 'sales'])).toBe('/finance/overview');
    expect(homePath('EMPLOYEE', [])).toBe('/finance/overview');
  });
});
