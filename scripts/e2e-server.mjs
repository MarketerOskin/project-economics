/**
 * Serve the (already built) app exactly as production does — standalone server —
 * for the Playwright E2E suite. Run `npm run build` before this (the test:e2e script does).
 * `next start` is not valid with output:'standalone'.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';

const PORT = process.env.PORT ?? '3100';

if (!existsSync('.next/standalone/server.js')) {
  throw new Error('.next/standalone missing — run `npm run build` first (test:e2e does).');
}

// Prepare the E2E database: schema + demo seed (idempotent).
if (process.env.DATABASE_URL) {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  if (existsSync('prisma/seed.mjs')) {
    execSync('node prisma/seed.mjs', { stdio: 'inherit' });
  } else if (existsSync('prisma/seed.ts')) {
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
  }
}

cpSync('public', '.next/standalone/public', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });

execSync('node .next/standalone/server.js', {
  stdio: 'inherit',
  env: { ...process.env, PORT, HOSTNAME: '0.0.0.0' },
});
