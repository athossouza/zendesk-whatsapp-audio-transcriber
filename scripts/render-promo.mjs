// Renders the Chrome Web Store small promo tile (440x280) to docs/store-assets/promo-440x280.png.
// Usage: node scripts/render-promo.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const icon = readFileSync(resolve(root, 'assets/icon.svg'), 'utf8');
const html = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0}
  .tile{width:440px;height:280px;box-sizing:border-box;padding:36px 34px;
    background:linear-gradient(135deg,#f3f7fb 0%,#e3eef8 100%);
    font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#293239;
    display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:16px}
  svg{width:72px;height:72px;flex:none}
  h1{font-size:26px;line-height:1.15;margin:0;font-weight:700}
  p{font-size:15px;line-height:1.45;margin:0;color:#5c6970}
  .brand{font-size:13px;font-weight:600;color:#1f73b7;letter-spacing:.04em}
</style>
<div class="tile">
  <div class="top">${icon}<h1>Transcrever Áudio<br>para Zendesk</h1></div>
  <p>Leia os áudios de WhatsApp dos tickets em segundos.<br>A transcrição roda no seu computador.</p>
  <div class="brand">ATVEZA</div>
</div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 280 } });
await page.setContent(html);
await page.screenshot({ path: resolve(root, 'docs/store-assets/promo-440x280.png') });
await browser.close();
console.log('promo tile rendered');
