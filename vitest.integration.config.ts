import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Integration / tenant-isolation test config. These suites spin a real Postgres
 * via Testcontainers (Docker required) and run the actual migrations + RLS, so
 * they get a generous timeout and run single-threaded to avoid port/container
 * contention. Kept separate from the fast unit run (`pnpm test`).
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',
    // Run suites serially to avoid container/port contention.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
