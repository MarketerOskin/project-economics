import { describe, it, expect, beforeAll } from 'vitest';
import { signSession, verifySession, type SessionPayload } from '@/lib/auth/session';

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
