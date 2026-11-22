// Chrome Web Store screenshots (1280x800) in the consultor.cx light look: headline on the
// left, the real screen cropped to what matters on the right, with a highlight and a label.
//
//   node scripts/render-screenshots.mjs → docs/store-assets/0{1,2,3}-*.png
//
// Sources: assets/store-raw/*.jpg (full captures of the d3v-atveza test ticket, 1568x769)
// and public/icons/128.png.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { panelMock, RAW_PANEL } from './panel-mock.mjs';

const root = resolve(import.meta.dirname, '..');
const dataUrl = (path, type) =>
  `data:${type};base64,${readFileSync(resolve(root, path)).toString('base64')}`;
const ICON = dataUrl('public/icons/128.png', 'image/png');
const RAW = {
  transcricao: dataUrl('assets/store-raw/transcricao.jpg', 'image/jpeg'),
  menu: dataUrl('assets/store-raw/menu.jpg', 'image/jpeg'),
};
const RAW_W = 1568;

const C = { bg: '#F6F3ED', ink: '#07110D', primary: '#03363D', accent: '#18D394' };

const base = `
  html,body{margin:0}
  .canvas{position:relative;width:1280px;height:800px;overflow:hidden;box-sizing:border-box;
    font-family:Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${C.ink};
    background:
      radial-gradient(circle at 88% 6%, rgba(24,211,148,.24), rgba(24,211,148,0) 42%),
      radial-gradient(circle at 10% 100%, rgba(3,54,61,.07), rgba(3,54,61,0) 40%),
      linear-gradient(rgba(3,54,61,.055) 1px, transparent 1px) 0 0/32px 32px,
      linear-gradient(90deg, rgba(3,54,61,.055) 1px, transparent 1px) 0 0/32px 32px,
      ${C.bg}}
  .brand{position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:12px;
    font-size:15px;font-weight:600;color:${C.primary}}
  .brand img{width:40px;height:40px}
  .copy{position:absolute;left:64px;top:210px;width:400px}
  .kicker{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;
    background:rgba(255,255,255,.7);border:1px solid rgba(3,54,61,.12);font-size:13px;font-weight:600;color:${C.primary}}
  .kicker i{width:7px;height:7px;border-radius:50%;background:${C.accent}}
  h1{margin:22px 0 0;font-size:46px;line-height:1.08;letter-spacing:-.025em;font-weight:750}
  h1 span{color:${C.primary}}
  p{margin:20px 0 0;font-size:19px;line-height:1.5;color:rgba(7,17,13,.68)}
  .foot{position:absolute;left:64px;bottom:52px;display:flex;align-items:center;gap:8px;
    font-size:14px;font-weight:600;color:${C.primary}}
  .foot i{width:8px;height:8px;border-radius:50%;background:${C.accent}}
  .card{position:absolute;border-radius:18px;overflow:hidden;background:#fff;
    box-shadow:0 0 0 1px rgba(3,54,61,.10), 0 32px 64px -12px rgba(3,54,61,.28), 0 8px 20px rgba(3,54,61,.08)}
  .shot{position:absolute;inset:0;background-repeat:no-repeat}
  .ring{position:absolute;border:3px solid ${C.accent};border-radius:14px;
    box-shadow:0 0 0 6px rgba(24,211,148,.20), 0 0 28px rgba(24,211,148,.45)}
  .label{position:absolute;display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:999px;
    background:${C.primary};color:#fff;font-size:14px;font-weight:600;white-space:nowrap;
    box-shadow:0 10px 24px -6px rgba(3,54,61,.45)}
  .label i{width:8px;height:8px;border-radius:50%;background:${C.accent}}
`;

const frame = (inner, copy) => `<!doctype html><meta charset="utf-8"><style>${base}</style>
<div class="canvas">
  <div class="brand"><img src="${ICON}">Transcrever Áudio para Zendesk</div>
  <div class="copy">${copy}</div>
  <div class="foot"><i></i>ATVEZA · consultor.cx</div>
  ${inner}
</div>`;

/** Real screen cropped to (x, y, w, h) of the raw capture, shown at `scale`, placed at (left, top). */
function shotCard(raw, crop, scale, left, top, overlays = '') {
  const w = Math.round(crop.w * scale);
  const h = Math.round(crop.h * scale);
  return `<div class="card" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px">
    <div class="shot" style="background-image:url(${raw});background-size:${RAW_W * scale}px auto;
      background-position:${-crop.x * scale}px ${-crop.y * scale}px"></div>${overlays}</div>`;
}

/** Overlay positioned in raw-capture pixels, mapped into the card. */
const at = (crop, scale, x, y, w, h) =>
  `left:${(x - crop.x) * scale}px;top:${(y - crop.y) * scale}px;width:${w * scale}px;height:${h * scale}px`;

const shots = [];

// 1 · Transcription box with live text.
{
  const crop = { x: 340, y: 268, w: 670, h: 480 };
  const s = 1.1;
  // Realistic support message drawn over the test capture's box (same look as the extension).
  const panel = panelMock({
    left: (RAW_PANEL.x - crop.x) * s,
    top: (RAW_PANEL.y - crop.y) * s,
    scale: s,
  });
  const ring = `<div class="ring" style="${at(crop, s, 428, 426, 468, 314)}"></div>`;
  const card = shotCard(RAW.transcricao, crop, s, 510, 112, panel + ring);
  const label = `<div class="label" style="left:830px;top:84px"><i></i>Transcrição no próprio ticket</div>`;
  shots.push([
    '01-transcricao',
    frame(
      card + label,
      `<span class="kicker"><i></i>Áudio de WhatsApp → texto</span>
       <h1>Leia o áudio<br><span>em segundos</span></h1>
       <p>O texto aparece ali mesmo, no ticket, enquanto é gerado. Copie ou salve como nota interna com um clique.</p>`,
    ),
  ]);
}

// 2 · The ⋯ button and its menu.
{
  const crop = { x: 340, y: 196, w: 670, h: 380 };
  const s = 1.1;
  const overlays =
    `<div class="ring" style="${at(crop, s, 928, 370, 36, 36)};border-radius:50%"></div>` +
    `<div class="ring" style="${at(crop, s, 721, 409, 242, 122)}"></div>`;
  const card = shotCard(RAW.menu, crop, s, 510, 196, overlays);
  const label = `<div class="label" style="left:1000px;top:150px"><i></i>Novo botão no player</div>`;
  shots.push([
    '02-menu',
    frame(
      card + label,
      `<span class="kicker"><i></i>Sem sair da conversa</span>
       <h1>Um clique no ⋯<br><span>ao lado do áudio</span></h1>
       <p>Transcrever, copiar o texto ou salvar como nota interna privada, direto no player do Zendesk.</p>`,
    ),
  ]);
}

// 3 · Privacy: everything happens on the agent's computer.
{
  const wave = Array.from({ length: 18 }, (_, i) => {
    const h = [14, 26, 40, 22, 34, 48, 30, 18, 38, 52, 28, 20, 42, 30, 16, 36, 24, 12][i];
    return `<span style="display:block;width:5px;height:${h}px;border-radius:3px;background:${C.primary}"></span>`;
  }).join('');
  const lines = [88, 72, 80, 56]
    .map(
      (w) =>
        `<span style="display:block;height:9px;width:${w}%;border-radius:5px;background:rgba(3,54,61,.22)"></span>`,
    )
    .join('');
  const check = (t) =>
    `<li style="display:flex;gap:12px;align-items:center;font-size:17px;color:${C.ink}">
       <span style="flex:none;width:26px;height:26px;border-radius:50%;background:rgba(24,211,148,.18);color:${C.primary};
         display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700">✓</span>${t}</li>`;
  const inner = `
  <div style="position:absolute;left:530px;top:215px;width:660px;height:340px;border-radius:24px;
     border:2px dashed rgba(3,54,61,.35);background:rgba(255,255,255,.55)">
    <div class="label" style="position:absolute;left:24px;top:-19px"><i></i>Seu computador</div>
    <div style="position:absolute;left:44px;top:80px;width:200px;height:120px;border-radius:16px;background:#fff;
       box-shadow:0 0 0 1px rgba(3,54,61,.10),0 16px 32px -10px rgba(3,54,61,.25);display:flex;flex-direction:column;
       align-items:center;justify-content:center;gap:12px">
      <div style="display:flex;align-items:center;gap:4px">${wave}</div>
      <span style="font-size:13px;font-weight:600;color:rgba(7,17,13,.6)">Áudio do cliente</span>
    </div>
    <div style="position:absolute;left:262px;top:118px;width:120px;text-align:center">
      <div style="height:3px;background:linear-gradient(90deg,${C.primary},${C.accent});border-radius:2px;margin-top:22px"></div>
      <div style="margin-top:10px;font-size:13px;font-weight:700;color:${C.primary}">IA local · Whisper</div>
    </div>
    <div style="position:absolute;left:400px;top:80px;width:216px;height:120px;border-radius:16px;background:#fff;
       box-shadow:0 0 0 1px rgba(3,54,61,.10),0 16px 32px -10px rgba(3,54,61,.25);box-sizing:border-box;padding:22px 20px;
       display:flex;flex-direction:column;gap:10px">${lines}</div>
    <ul style="position:absolute;left:44px;top:250px;margin:0;padding:0;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:18px 28px;width:580px">
      ${check('O áudio não sai da máquina')}${check('Sem custo por transcrição')}
      ${check('Sem telemetria')}${check('Nota interna sempre privada')}
    </ul>
  </div>`;
  shots.push([
    '03-privacidade',
    frame(
      inner,
      `<span class="kicker"><i></i>Privacidade por padrão</span>
       <h1>A IA roda no<br><span>seu computador</span></h1>
       <p>A transcrição acontece no navegador do agente. O áudio do cliente não é enviado para nenhum servidor.</p>`,
    ),
  ]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
for (const [name, html] of shots) {
  await page.setContent(html);
  await page.screenshot({ path: resolve(root, `docs/store-assets/${name}.png`) });
}
await browser.close();
console.log(`rendered ${shots.length} store screenshots`);
