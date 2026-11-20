// The extension's transcription box, drawn in HTML with the same measurements and
// colors as entrypoints/content/ui/styles.css. Used by the store/YouTube images to
// replace the text of the test capture with a realistic support message.
//
// Raw-capture coordinates (assets/store-raw/transcricao.jpg, 1568x769 CSS px):
export const RAW_PANEL = { x: 432, y: 430, w: 460, h: 305 };

/** Realistic customer message used in the marketing images. */
export const SAMPLE = {
  duration: '1:04',
  paragraphs: [
    'Bom dia! Desde ontem o EDGECAM não abre no computador da programação. Aparece uma mensagem dizendo que a licença não foi encontrada.',
    'Já reiniciei a máquina e conferi se o dongle está conectado, mas o erro continua.',
    'Hoje temos três peças para programar, então é urgente. Vocês conseguem acessar remotamente ainda pela manhã? Obrigado!',
  ],
};

/**
 * The box at raw size (RAW_PANEL.w x RAW_PANEL.h), scaled by `scale`.
 * Place it with `left`/`top` in the destination's pixels.
 */
export function panelMock({ left, top, scale, sample = SAMPLE }) {
  const p = sample.paragraphs
    // <div>, not <p>: the host pages style `p` globally.
    .map((t, i, all) => `<div style="margin:0 0 ${i === all.length - 1 ? 0 : 0.75}em">${t}</div>`)
    .join('');
  return `<div style="position:absolute;left:${left}px;top:${top}px;width:${RAW_PANEL.w}px;height:${RAW_PANEL.h}px;
    transform:scale(${scale});transform-origin:0 0;box-sizing:border-box;display:flex;flex-direction:column;
    background:#fff;border:1px solid #e8eaec;border-radius:8px;box-shadow:0 4px 12px rgba(4,68,77,.1);
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#293239;-webkit-font-smoothing:antialiased">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 8px 2px 16px">
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;line-height:16px;color:#5c6970">
        Transcrição<span style="font-weight:400;color:#6e7780">· ${sample.duration}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#848f99" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 7.5v3.5M8 5h.01"/></svg>
      </span>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#848f99" stroke-width="1.5" stroke-linecap="round"><path d="M8 8l8 8M16 8l-8 8"/></svg>
    </div>
    <div style="flex:1;padding:4px 16px 10px;font-size:14px;line-height:1.5">${p}</div>
    <div style="display:flex;align-items:center;gap:16px;padding:0 16px 12px;font-size:12px;line-height:16px;color:#1f73b7">
      <span>Copiar</span><span>Transcrever de novo</span><span style="flex:1"></span><span style="font-weight:600">Salvar como nota interna</span>
    </div>
  </div>`;
}
