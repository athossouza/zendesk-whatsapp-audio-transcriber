import { resolve } from 'node:path';
import { test as base, chromium, type BrowserContext } from '@playwright/test';

const EXTENSION = resolve(import.meta.dirname, '../../.output/chrome-mv3');
/** Persistent profile so the model is downloaded only once between runs. */
const PROFILE = resolve(import.meta.dirname, '../../.playwright-profile');

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext(PROFILE, {
      channel: 'chromium',
      headless: process.env.HEADED !== '1',
      args: [
        `--disable-extensions-except=${EXTENSION}`,
        `--load-extension=${EXTENSION}`,
        '--enable-unsafe-webgpu',
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;
