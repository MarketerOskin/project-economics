/**
 * Build and run the app exactly as production does (standalone server),
 * for the Playwright E2E suite. `next start` is not valid with output:'standalone'.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';

const PORT = process.env.PORT ?? '3100';

execSync('npm run build', { stdio: 'inherit' });

// Prepare the E2E database: schema + demo seed (idempotent).
if (process.env.DATABASE_URL) {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  if (existsSync('prisma/seed.ts')) {
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
  }
}

cpSync('public', '.next/standalone/public', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });

if (!existsSync('.next/standalone/server.js')) {
  throw new Error('standalone server.js missing — is output:"standalone" set in next.config.ts?');
}

execSync(`node .next/standalone/server.js`, {
  stdio: 'inherit',
  env: { ...process.env, PORT, HOSTNAME: '127.0.0.1' },
});
