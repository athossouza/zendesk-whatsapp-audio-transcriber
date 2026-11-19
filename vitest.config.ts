import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

const devClient = readFileSync(resolve(import.meta.dirname, 'clients/dev.json'), 'utf8');

export default defineConfig({
  plugins: [WxtVitest()],
  define: { __CLIENT__: devClient },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
