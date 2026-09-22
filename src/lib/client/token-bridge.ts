import { SESSION_HEADER } from '@/lib/auth/constants';

/**
 * Fallback session transport for browsers that block the pe_session cookie outright inside
 * the Bitrix24 iframe (confirmed against production traffic, not a hypothesis — ADR-024).
 * issueSession() carries the token in the redirect URL; this module picks it up, stashes it in
 * localStorage (same-origin storage, not subject to third-party cookie blocking), and replays
 * it as a header on every same-origin fetch afterward — including Next's own router fetches for
 * client-side navigation, since patching the global `fetch` catches those too.
 */
const TOKEN_KEY = 'pe_session_token';

/** Pull `?pe_token=` out of the current URL into localStorage, then scrub it from the address bar. */
export function bridgeTokenFromUrlOnce(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('pe_token');
  if (!token) return;

  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode, disabled) — this load already got the token
    // server-side via proxy.ts; later navigations just won't carry the header.
  }

  params.delete('pe_token');
  const query = params.toString();
  const clean = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
  window.history.replaceState(null, '', clean);
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let patched = false;

/** Idempotent: attaches the bridged token to same-origin fetches, once, for the whole tab. */
export function patchFetchWithBridgedToken(): void {
  if (patched || typeof window === 'undefined') return;
  patched = true;

  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const token = readToken();
    if (!token) return original(input, init);

    const url = input instanceof Request ? input.url : input.toString();
    const isSameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
    if (!isSameOrigin) return original(input, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(SESSION_HEADER, token);
    return original(input, { ...init, headers });
  };
}
