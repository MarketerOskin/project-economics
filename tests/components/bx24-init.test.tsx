import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Bx24Init } from '@/components/bitrix/bx24-init';
import * as sessionModule from '@/lib/client/session';

vi.mock('@/lib/client/session', () => ({ useSession: vi.fn() }));

function mockSession(value: { demo: boolean } | null) {
  vi.mocked(sessionModule.useSession).mockReturnValue({
    session: value as unknown as sessionModule.ClientSession | null,
    loading: false,
    refresh: vi.fn(),
    switchRole: vi.fn(),
  });
}

describe('Bx24Init (Bitrix24 embed handshake)', () => {
  beforeEach(() => {
    document.getElementById('bx24-js-sdk')?.remove();
    delete window.BX24;
  });
  afterEach(() => {
    document.getElementById('bx24-js-sdk')?.remove();
    delete window.BX24;
  });

  it('does nothing in demo mode — there is no Bitrix parent frame to talk to', () => {
    mockSession({ demo: true });
    render(<Bx24Init />);
    expect(document.getElementById('bx24-js-sdk')).toBeNull();
  });

  it('does nothing while the session has not resolved yet', () => {
    mockSession(null);
    render(<Bx24Init />);
    expect(document.getElementById('bx24-js-sdk')).toBeNull();
  });

  it('injects the Bitrix24 SDK script on a real portal and calls BX24.init on load', async () => {
    mockSession({ demo: false });
    render(<Bx24Init />);

    const script = document.getElementById('bx24-js-sdk') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.src).toBe('https://api.bitrix24.com/api/v1/');

    const init = vi.fn((cb: () => void) => cb());
    window.BX24 = { init, fitWindow: vi.fn() };
    script?.onload?.(new Event('load'));

    expect(init).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(window.BX24?.fitWindow).toHaveBeenCalledTimes(1));
  });

  it('calls BX24.init directly, without injecting a script, when BX24 is already present', async () => {
    const init = vi.fn((cb: () => void) => cb());
    window.BX24 = { init, fitWindow: vi.fn() };

    mockSession({ demo: false });
    render(<Bx24Init />);

    expect(document.getElementById('bx24-js-sdk')).toBeNull();
    expect(init).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(window.BX24?.fitWindow).toHaveBeenCalledTimes(1));
  });

  it('tries to fit the frame to the screen first and stretches it only when that fails', async () => {
    const getScrollSize = vi.fn(() => ({ scrollWidth: 1200, scrollHeight: 3000 }));
    const fitWindow = vi.fn((cb?: () => void) => cb?.());
    window.BX24 = { init: (cb) => cb(), fitWindow, getScrollSize };
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });

    mockSession({ demo: false });
    render(<Bx24Init />);

    // Outside a real iframe the visible slice can't be measured: after the first (tall) fit it
    // gives up and stretches the frame as before.
    await waitFor(() => expect(fitWindow).toHaveBeenCalledTimes(2), { timeout: 2000 });
    // The swapped getScrollSize is put back.
    expect(window.BX24?.getScrollSize).toBe(getScrollSize);
  });

  it('leaves a narrow frame stretched, without fitting it', async () => {
    const fitWindow = vi.fn((cb?: () => void) => cb?.());
    window.BX24 = {
      init: (cb) => cb(),
      fitWindow,
      getScrollSize: () => ({ scrollWidth: 500, scrollHeight: 3000 }),
    };
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 });

    mockSession({ demo: false });
    render(<Bx24Init />);

    await waitFor(() => expect(fitWindow).toHaveBeenCalledTimes(1));
  });
});
