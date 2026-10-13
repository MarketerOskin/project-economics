import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewTabLink } from '@/components/ui/new-tab-link';

describe('NewTabLink', () => {
  const open = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('open', open);
    open.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('hands the bridged session token to the new tab', async () => {
    window.localStorage.setItem('pe_session_token', 'tok-1');
    render(<NewTabLink href="/report/projects/p1?period=month">Отчёт</NewTabLink>);

    await userEvent.click(screen.getByText('Отчёт'));

    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe('/report/projects/p1');
    expect(url.searchParams.get('period')).toBe('month');
    expect(url.searchParams.get('pe_token')).toBe('tok-1');
  });

  it('stays a plain new-tab link when the cookie carries the session', () => {
    render(<NewTabLink href="/report/projects/p1">Отчёт</NewTabLink>);
    const a = screen.getByText('Отчёт').closest('a')!;
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('href')).toBe('/report/projects/p1');
  });
});
