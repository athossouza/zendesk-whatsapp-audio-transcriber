import { render } from 'preact';
import type { AudioCandidate } from './detector';
import { AudioTools, type AudioContextInfo, type KnownTranscript } from './ui/AudioTools';
import css from './ui/styles.css?inline';

export const AUDIO_ATTR = 'data-atveza-audio';
const HOST_TAG = 'atveza-audio-tools';
/** Closed in production (spec section 5); open only in the e2e build so Playwright can see inside. */
const SHADOW_MODE: ShadowRootMode = import.meta.env.WXT_E2E === '1' ? 'open' : 'closed';

export interface Injected {
  buttonHost: HTMLElement;
  panelHost: HTMLElement;
  update: (known: KnownTranscript | null) => void;
  remove: () => void;
}

/**
 * Adds the ⋯ button next to the player's download button (or in the corner of
 * the bubble) and a slot for the transcription box below the player. Both live
 * in closed shadow roots so Zendesk CSS and ours never mix (spec section 5).
 */
export function inject(
  candidate: AudioCandidate,
  ctx: Omit<AudioContextInfo, 'panelRoot'>,
  known: KnownTranscript | null,
): Injected {
  candidate.player.setAttribute(AUDIO_ATTR, ctx.audioKey);

  const buttonHost = document.createElement(HOST_TAG);
  const buttonRoot = buttonHost.attachShadow({ mode: SHADOW_MODE });
  addStyle(buttonRoot);
  if (candidate.anchor) {
    buttonHost.style.display = 'inline-flex';
    buttonHost.style.alignSelf = 'center';
    candidate.anchor.insertAdjacentElement('afterend', buttonHost);
  } else {
    const box = candidate.bubble ?? candidate.player;
    if (getComputedStyle(box).position === 'static')
      (box as HTMLElement).style.position = 'relative';
    Object.assign(buttonHost.style, {
      position: 'absolute',
      top: '4px',
      right: '4px',
      zIndex: '1',
    });
    box.appendChild(buttonHost);
  }

  const panelHost = document.createElement(HOST_TAG);
  panelHost.style.display = 'block';
  const panelRoot = panelHost.attachShadow({ mode: SHADOW_MODE });
  addStyle(panelRoot);
  candidate.player.insertAdjacentElement('afterend', panelHost);

  const fullCtx: AudioContextInfo = { ...ctx, panelRoot };
  const draw = (k: KnownTranscript | null) =>
    render(<AudioTools ctx={fullCtx} known={k} />, buttonRoot);
  draw(known);

  return {
    buttonHost,
    panelHost,
    update: draw,
    remove: () => {
      render(null, buttonRoot);
      buttonHost.remove();
      panelHost.remove();
      candidate.player.removeAttribute(AUDIO_ATTR);
    },
  };
}

function addStyle(root: ShadowRoot): void {
  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);
}
