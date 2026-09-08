import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineWorkspace([
  {
    // Pure domain / library logic. No DOM, no DB.
    plugins: [tsconfigPaths()],
    test: {
      name: 'unit',
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
    },
  },
  {
    // React component tests.
    plugins: [tsconfigPaths(), react()],
    test: {
      name: 'components',
      environment: 'jsdom',
      globals: true,
      setupFiles: ['tests/helpers/setup-dom.ts'],
      include: ['tests/components/**/*.test.tsx'],
    },
  },
  {
    // API / persistence tests against the real test PostgreSQL (docker-compose.test.yml).
    plugins: [tsconfigPaths()],
    test: {
      name: 'integration',
      environment: 'node',
      include: ['tests/integration/**/*.test.ts'],
      setupFiles: ['tests/helpers/setup-db.ts'],
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
      hookTimeout: 30_000,
      testTimeout: 20_000,
      // DB-backed tests can hit a transient connection blip under heavy host load.
      retry: 1,
    },
  },
]);
