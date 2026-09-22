import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { SESSION_HEADER } from '@/lib/auth/constants';

beforeAll(() => {
  process.env.SESSION_SECRET = 'proxy-test-secret-at-least-32-bytes-long-xxx';
});

function req(url: string, init?: { cookie?: string; header?: string }) {
  const headers = new Headers();
  if (init?.cookie) headers.set('cookie', init.cookie);
  if (init?.header) headers.set(SESSION_HEADER, init.header);
  return new NextRequest(`http://localhost${url}`, { headers });
}

describe('proxy: session-cookie bridge (ADR-024)', () => {
  const originalDemoMode = process.env.DEMO_MODE;
  afterEach(() => {
    process.env.DEMO_MODE = originalDemoMode;
  });

  it('bridges ?pe_token= into the request cookie jar for this same pass (what Server Components read)', () => {
    process.env.DEMO_MODE = 'false';
    const request = req('/finance?pe_token=abc123');
    proxy(request);
    // Mutating req.cookies is the actual bridge — this is what a downstream cookies() call sees.
    expect(request.cookies.get(SESSION_COOKIE)?.value).toBe('abc123');
  });

  it('also best-effort re-sets the cookie on the response, for browsers that do accept it', () => {
    process.env.DEMO_MODE = 'false';
    const res = proxy(req('/finance?pe_token=abc123'));
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe('abc123');
  });

  it('bridges the x-pe-session header the same way (client-side fetch/RSC navigation path)', () => {
    process.env.DEMO_MODE = 'false';
    const request = req('/finance', { header: 'from-header-token' });
    proxy(request);
    expect(request.cookies.get(SESSION_COOKIE)?.value).toBe('from-header-token');
  });

  it('does nothing when a real session cookie is already present (no override, no redundant Set-Cookie)', () => {
    process.env.DEMO_MODE = 'false';
    const request = req('/finance?pe_token=abc123', { cookie: `${SESSION_COOKIE}=real-cookie-value` });
    const res = proxy(request);
    expect(request.cookies.get(SESSION_COOKIE)?.value).toBe('real-cookie-value');
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it('is a no-op (plain pass-through) with neither a cookie nor a bridge token', () => {
    process.env.DEMO_MODE = 'false';
    const res = proxy(req('/finance'));
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(res.headers.get('location')).toBeNull();
  });

  it('DEMO_MODE bounce still fires when nothing bridges a session (regression check)', () => {
    process.env.DEMO_MODE = 'true';
    const res = proxy(req('/finance'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/api/demo/bootstrap');
  });

  it('DEMO_MODE bounce does not fire once a token bridges a session', () => {
    process.env.DEMO_MODE = 'true';
    const res = proxy(req('/finance?pe_token=abc123'));
    expect(res.headers.get('location')).toBeNull();
  });
});
