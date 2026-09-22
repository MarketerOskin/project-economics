import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { signSession, verifySession, sessionCookieOptions, type SessionPayload } from '@/lib/auth/session';
import { csrfCookieOptions } from '@/lib/csrf';

const payload: SessionPayload = {
  portalId: 'portal_1',
  appUserId: 'user_1',
  role: 'MANAGER',
  demo: true,
};

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-session-secret-at-least-32-bytes-long-000';
});

describe('session cookie', () => {
  it('round-trips sign -> verify', async () => {
    const token = await signSession(payload);
    expect(await verifySession(token)).toMatchObject(payload);
  });

  it('rejects a tampered token', async () => {
    const token = await signSession(payload);
    const tampered = token.slice(0, -3) + 'aaa';
    expect(await verifySession(tampered)).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await verifySession('not-a-jwt')).toBeNull();
    expect(await verifySession('')).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession(payload);
    process.env.SESSION_SECRET = 'a-completely-different-secret-value-32-bytes';
    expect(await verifySession(token)).toBeNull();
    process.env.SESSION_SECRET = 'test-session-secret-at-least-32-bytes-long-000';
  });
});

describe('cookie policy — CHIPS (ADR-023)', () => {
  const originalAppUrl = process.env.APP_URL;
  afterEach(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
  });

  it('https:// deployment (real Bitrix24 iframe): Secure + SameSite=None + Partitioned', () => {
    process.env.APP_URL = 'https://economics.toxick.ru';
    const session = sessionCookieOptions();
    expect(session).toMatchObject({ secure: true, sameSite: 'none', partitioned: true });
    const csrf = csrfCookieOptions();
    expect(csrf).toMatchObject({ secure: true, sameSite: 'none', partitioned: true });
  });

  it('http:// deployment (local/demo by IP): not Secure, no Partitioned — a Secure cookie would be dropped outright', () => {
    process.env.APP_URL = 'http://159.194.205.246';
    const session = sessionCookieOptions();
    expect(session).toMatchObject({ secure: false, sameSite: 'lax', partitioned: false });
    const csrf = csrfCookieOptions();
    expect(csrf).toMatchObject({ secure: false, sameSite: 'lax', partitioned: false });
  });
});
