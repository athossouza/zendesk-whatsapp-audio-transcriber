// Renders assets/icon.svg to public/icons/{16,32,48,128}.png with Playwright's Chromium.
// Usage: node scripts/render-icons.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'assets/icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  // Chrome Web Store: the 128 px icon has 96 px of artwork and 16 px transparent margin.
  const art = size === 128 ? 96 : size;
  const pad = (size - art) / 2;
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${art}px;height:${art}px;margin:${pad}px}</style>${svg}`,
  );
  await page.screenshot({
    path: resolve(root, `public/icons/${size}.png`),
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}
await browser.close();
console.log('icons rendered');
