import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { testDb, resetDb } from '../helpers/db';
import { GET as bootstrapRoute } from '@/app/api/demo/bootstrap/route';

process.env.SESSION_SECRET = 'demo-bootstrap-test-secret-at-least-32-bytes';
process.env.APP_URL = 'https://economics.example.com';

function req(query = '') {
  return new NextRequest(`http://localhost/api/demo/bootstrap${query}`);
}

describe('demo bootstrap: what a sessionless visitor gets redirected to', () => {
  const originalDemoMode = process.env.DEMO_MODE;
  beforeEach(resetDb);
  afterAll(async () => {
    await testDb.$disconnect();
    process.env.DEMO_MODE = originalDemoMode;
  });

  it('with DEMO_MODE off (real production), sends the visitor to the public /contact page — never a 500', async () => {
    process.env.DEMO_MODE = 'false';
    const res = await bootstrapRoute(req('?next=/'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toBe('https://economics.example.com/contact');
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });

  it('with DEMO_MODE on, seeds/signs in as the demo ADMIN and redirects to `next` (token appended for ADR-024)', async () => {
    process.env.DEMO_MODE = 'true';
    const res = await bootstrapRoute(req('?next=/finance'));
    const location = new URL(res.headers.get('location')!);
    expect(`${location.origin}${location.pathname}`).toBe('https://economics.example.com/finance');
    expect(location.searchParams.get('pe_token')).toBeTruthy();
    expect(res.headers.getSetCookie().join(';')).toContain('pe_session=');
  });
});
