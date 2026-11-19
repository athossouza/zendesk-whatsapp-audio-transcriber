import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { test as base, chromium, type BrowserContext } from '@playwright/test';

const EXTENSION = resolve(import.meta.dirname, '../../.output-e2e/chrome-mv3');
/** Persistent profile so the model is downloaded only once between runs. */
// Kept outside the project: the models are ~1.5 GB and project folders may be
// synced (iCloud/Drive), which stalls file access.
const PROFILE =
  process.env.PW_PROFILE ??
  resolve(homedir(), 'Library/Caches/zendesk-whatsapp-audio-transcriber/playwright-profile');

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
