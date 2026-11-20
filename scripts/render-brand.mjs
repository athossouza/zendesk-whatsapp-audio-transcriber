// Renders the extension icons and the Chrome Web Store promo tile from the brand files.
//
//   node scripts/render-brand.mjs              → public/icons/*.png + docs/store-assets/promo-440x280.png
//   NO_ZENDESK=1 node scripts/render-brand.mjs → same, without the Zendesk badge (fallback if the
//                                                store review objects to the trademark)
//
// Sources: assets/brand/atveza-logo-footer.png (footer logo of consultor.cx) and
// assets/brand/zendesk-mark.svg (Zendesk "Z", unchanged). Palette from consultor.cx (light theme).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const withZendesk = process.env.NO_ZENDESK !== '1';

const COLORS = {
  background: '#F6F3ED',
  ink: '#07110D',
  primary: '#03363D',
  accent: '#18D394',
};

// ATVEZA mark: circle inside the 1254 px footer logo (measured on the image).
const LOGO = { size: 1254, cx: 626, cy: 444, r: 258 };
const logoData = `data:image/png;base64,${readFileSync(resolve(root, 'assets/brand/atveza-logo-footer.png')).toString('base64')}`;
const zendeskSvg = readFileSync(resolve(root, 'assets/brand/zendesk-mark.svg'), 'utf8').replace(
  /<!--[\s\S]*?-->/,
  '',
);

/** ATVEZA circle of diameter `d`, with the Zendesk badge in the bottom-right corner. */
function mark(d, { badge = withZendesk } = {}) {
  const scale = d / (LOGO.r * 2);
  const bg = `background:url(${logoData}) no-repeat;background-size:${LOGO.size * scale}px;background-position:${-(LOGO.cx - LOGO.r) * scale}px ${-(LOGO.cy - LOGO.r) * scale}px`;
  const b = Math.round(d * 0.46);
  const badgeHtml = badge
    ? `<div style="position:absolute;right:${-d * 0.02}px;bottom:${-d * 0.02}px;width:${b}px;height:${b}px;border-radius:50%;
        background:#fff;box-shadow:0 0 0 ${Math.max(1, d * 0.025)}px ${COLORS.background};display:flex;align-items:center;justify-content:center">
        <div style="width:${b * 0.62}px;display:flex">${zendeskSvg.replace('<svg ', '<svg style="width:100%;height:auto;display:block" ')}</div>
      </div>`
    : '';
  return `<div style="position:relative;width:${d}px;height:${d}px">
    <div style="width:${d}px;height:${d}px;border-radius:50%;${bg}"></div>${badgeHtml}</div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();

// Icons. The 128 px store icon keeps 16 px of transparent margin (Chrome Web Store guideline).
// At 16 px the badge would be an unreadable dot, so the toolbar icon shows only the ATVEZA mark.
for (const size of [16, 32, 48, 128]) {
  const art = size === 128 ? 96 : size;
  const pad = (size - art) / 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}</style><div style="padding:${pad}px">${mark(art, { badge: withZendesk && size >= 32 })}</div>`,
  );
  await page.screenshot({
    path: resolve(root, `public/icons/${size}.png`),
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}

// Small promo tile, consultor.cx light look: warm background, faint grid, green glow.
await page.setViewportSize({ width: 440, height: 280 });
await page.setContent(`<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0}
  .tile{position:relative;width:440px;height:280px;box-sizing:border-box;padding:34px 34px 30px;overflow:hidden;
    background:
      radial-gradient(circle at 92% 8%, rgba(24,211,148,.22), rgba(24,211,148,0) 46%),
      linear-gradient(rgba(3,54,61,.06) 1px, transparent 1px) 0 0/28px 28px,
      linear-gradient(90deg, rgba(3,54,61,.06) 1px, transparent 1px) 0 0/28px 28px,
      ${COLORS.background};
    font-family:Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${COLORS.ink};
    display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:18px}
  h1{font-size:27px;line-height:1.1;margin:0;font-weight:700;letter-spacing:-.02em}
  h1 span{color:${COLORS.primary}}
  p{font-size:15px;line-height:1.45;margin:0;color:rgba(7,17,13,.68)}
  .brand{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:${COLORS.primary};letter-spacing:.02em}
  .dot{width:7px;height:7px;border-radius:50%;background:${COLORS.accent}}
</style>
<div class="tile">
  <div class="top">${mark(84)}<h1>Transcrever Áudio<br><span>para Zendesk</span></h1></div>
  <p>Leia os áudios de WhatsApp dos tickets em segundos.<br>A transcrição roda no seu computador.</p>
  <div class="brand"><span class="dot"></span>ATVEZA · consultor.cx</div>
</div>`);
await page.screenshot({ path: resolve(root, 'docs/store-assets/promo-440x280.png') });

await browser.close();
console.log(`brand rendered ${withZendesk ? 'with' : 'without'} Zendesk badge`);
