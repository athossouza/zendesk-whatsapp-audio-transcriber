// YouTube thumbnail (1280x720) for the promo video, consultor.cx light look.
//   node scripts/render-thumbnail.mjs → docs/store-assets/youtube-thumbnail.png
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { panelMock, RAW_PANEL } from './panel-mock.mjs';

const root = resolve(import.meta.dirname, '..');
const b64 = (p) => readFileSync(resolve(root, p)).toString('base64');
const ICON = `data:image/png;base64,${b64('public/icons/128.png')}`;
const RAW = `data:image/jpeg;base64,${b64('assets/store-raw/transcricao.jpg')}`;
const crop = { x: 428, y: 426, w: 468, h: 314 }; // transcription box in the raw capture
const s = 1.25;

const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0}
.c{position:relative;width:1280px;height:720px;overflow:hidden;font-family:Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#07110D;
background:radial-gradient(circle at 92% 0%,rgba(24,211,148,.32),rgba(24,211,148,0) 45%),
linear-gradient(rgba(3,54,61,.06) 1px,transparent 1px) 0 0/36px 36px,linear-gradient(90deg,rgba(3,54,61,.06) 1px,transparent 1px) 0 0/36px 36px,#F6F3ED}
.brand{position:absolute;left:56px;top:48px;display:flex;align-items:center;gap:14px;font-size:24px;font-weight:700;color:#03363D}
.brand img{width:56px;height:56px}
h1{position:absolute;left:56px;top:150px;width:600px;margin:0;font-size:82px;line-height:1.02;letter-spacing:-.035em;font-weight:850}
h1 span{display:block}h1 .em{color:#03363D}
.pill{position:absolute;left:56px;top:520px;display:inline-flex;align-items:center;gap:12px;padding:16px 26px;border-radius:999px;background:#03363D;color:#fff;font-size:28px;font-weight:700}
.pill i{width:14px;height:14px;border-radius:50%;background:#18D394;display:block}
.card{position:absolute;left:670px;top:150px;width:${crop.w * s}px;height:${crop.h * s}px;border-radius:18px;overflow:hidden;
background:url(${RAW}) no-repeat;background-size:${1568 * s}px auto;background-position:${-crop.x * s}px ${-crop.y * s}px;
box-shadow:0 0 0 4px #18D394,0 0 0 12px rgba(24,211,148,.22),0 40px 80px -20px rgba(3,54,61,.45)}
</style><div class="c">
<div class="brand"><img src="${ICON}">ATVEZA · consultor.cx</div>
<h1><span>Áudio do</span><span>WhatsApp</span><span class="em">vira texto</span></h1>
<div class="pill"><i></i>Direto no Zendesk</div>
<div class="card">${panelMock({ left: (RAW_PANEL.x - crop.x) * s, top: (RAW_PANEL.y - crop.y) * s, scale: s })}</div></div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html);
await page.screenshot({ path: resolve(root, 'docs/store-assets/youtube-thumbnail.png') });
await browser.close();
console.log('thumbnail rendered');
