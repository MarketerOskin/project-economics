import { describe, it, expect, afterEach } from 'vitest';
import { isPortalAuthorized, allowlistEnabled } from '@/lib/bitrix/licensing';

const A = process.env.ALLOWED_PORTAL_MEMBER_IDS;
const D = process.env.ALLOWED_PORTAL_DOMAINS;

afterEach(() => {
  if (A === undefined) delete process.env.ALLOWED_PORTAL_MEMBER_IDS;
  else process.env.ALLOWED_PORTAL_MEMBER_IDS = A;
  if (D === undefined) delete process.env.ALLOWED_PORTAL_DOMAINS;
  else process.env.ALLOWED_PORTAL_DOMAINS = D;
});

describe('portal allowlist', () => {
  it('is disabled (allows everyone) when no env is set', () => {
    delete process.env.ALLOWED_PORTAL_MEMBER_IDS;
    delete process.env.ALLOWED_PORTAL_DOMAINS;
    expect(allowlistEnabled()).toBe(false);
    expect(isPortalAuthorized({ memberId: 'anything', domain: 'x.bitrix24.ru' })).toBe(true);
  });

  it('permits only listed member ids (case-insensitive, trimmed)', () => {
    process.env.ALLOWED_PORTAL_MEMBER_IDS = ' ABC123 , def456';
    delete process.env.ALLOWED_PORTAL_DOMAINS;
    expect(isPortalAuthorized({ memberId: 'abc123', domain: 'x.bitrix24.ru' })).toBe(true);
    expect(isPortalAuthorized({ memberId: 'DEF456', domain: 'x.bitrix24.ru' })).toBe(true);
    expect(isPortalAuthorized({ memberId: 'other', domain: 'x.bitrix24.ru' })).toBe(false);
  });

  it('permits by domain too', () => {
    delete process.env.ALLOWED_PORTAL_MEMBER_IDS;
    process.env.ALLOWED_PORTAL_DOMAINS = 'client.bitrix24.ru';
    expect(isPortalAuthorized({ memberId: 'x', domain: 'client.bitrix24.ru' })).toBe(true);
    expect(isPortalAuthorized({ memberId: 'x', domain: 'attacker.bitrix24.ru' })).toBe(false);
  });

  it('always allows the demo portal, even with an allowlist set', () => {
    process.env.ALLOWED_PORTAL_MEMBER_IDS = 'only-this-one';
    expect(isPortalAuthorized({ memberId: 'demo', domain: 'demo.bitrix24.ru', isDemo: true })).toBe(true);
  });
});
