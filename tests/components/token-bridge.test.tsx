import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SESSION_HEADER } from '@/lib/auth/constants';

/** Each test gets a fresh module instance — `patchFetchWithBridgedToken` is idempotent-by-design (once per tab). */
async function freshBridge() {
  vi.resetModules();
  return import('@/lib/client/token-bridge');
}

describe('token-bridge (ADR-024: session transport for cookie-blocked browsers)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  describe('bridgeTokenFromUrlOnce', () => {
    it('stashes ?pe_token= into localStorage and scrubs it from the URL', async () => {
      const { bridgeTokenFromUrlOnce } = await freshBridge();
      window.history.replaceState(null, '', '/finance?pe_token=abc123&other=1');

      bridgeTokenFromUrlOnce();

      expect(window.localStorage.getItem('pe_session_token')).toBe('abc123');
      expect(window.location.pathname).toBe('/finance');
      expect(window.location.search).toBe('?other=1');
      expect(window.location.search).not.toContain('pe_token');
    });

    it('does nothing when there is no token in the URL', async () => {
      const { bridgeTokenFromUrlOnce } = await freshBridge();
      window.history.replaceState(null, '', '/finance?other=1');

      bridgeTokenFromUrlOnce();

      expect(window.localStorage.getItem('pe_session_token')).toBeNull();
      expect(window.location.search).toBe('?other=1');
    });
  });

  describe('patchFetchWithBridgedToken', () => {
    it('attaches the bridged token as a header on a same-origin fetch', async () => {
      const { bridgeTokenFromUrlOnce, patchFetchWithBridgedToken } = await freshBridge();
      window.history.replaceState(null, '', '/finance?pe_token=abc123');
      bridgeTokenFromUrlOnce();

      const original = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response('ok'));
      window.fetch = original as unknown as typeof fetch;
      patchFetchWithBridgedToken();

      await window.fetch('/api/session');

      expect(original).toHaveBeenCalledTimes(1);
      const [, init] = original.mock.calls[0]!;
      const headers = new Headers((init as RequestInit).headers);
      expect(headers.get(SESSION_HEADER)).toBe('abc123');
    });

    it('leaves the request alone when there is no bridged token', async () => {
      const { patchFetchWithBridgedToken } = await freshBridge();
      const original = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response('ok'));
      window.fetch = original as unknown as typeof fetch;
      patchFetchWithBridgedToken();

      await window.fetch('/api/session');

      expect(original).toHaveBeenCalledWith('/api/session', undefined);
    });

    it('does not attach the token to a cross-origin request', async () => {
      const { bridgeTokenFromUrlOnce, patchFetchWithBridgedToken } = await freshBridge();
      window.history.replaceState(null, '', '/finance?pe_token=abc123');
      bridgeTokenFromUrlOnce();

      const original = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response('ok'));
      window.fetch = original as unknown as typeof fetch;
      patchFetchWithBridgedToken();

      await window.fetch('https://evil.example.com/steal');

      const [, init] = original.mock.calls[0]!;
      expect(init).toBeUndefined();
    });
  });
});
