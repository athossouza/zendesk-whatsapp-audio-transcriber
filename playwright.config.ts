import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  timeout: 10 * 60 * 1000,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', actionTimeout: 30_000 },
});
