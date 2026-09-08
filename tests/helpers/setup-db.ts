/**
 * Integration-test bootstrap. Runs before any test file in the `integration` project.
 * Points the app's Prisma client at the throwaway test database and ensures the schema
 * is applied. `docker compose -f docker-compose.test.yml up -d` must be running.
 */
import { execSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import { beforeAll } from 'vitest';

loadEnv({ path: '.env' });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL is not set (see .env.example).');
}
// The app client reads DATABASE_URL at import time — override it before anything imports it.
process.env.DATABASE_URL = testUrl;
process.env.DEMO_MODE = 'true';

let schemaReady = false;

beforeAll(() => {
  if (schemaReady) return;
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: testUrl },
    });
    schemaReady = true;
  } catch (err) {
    const out = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not prepare the test database at ${testUrl}.\n` +
        'Start it with:  docker compose -f docker-compose.test.yml up -d\n\n' +
        out,
    );
  }
});
