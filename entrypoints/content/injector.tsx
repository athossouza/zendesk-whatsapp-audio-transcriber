import { render } from 'preact';
import type { AudioCandidate } from './detector';
import { AudioTools, type AudioContextInfo, type KnownTranscript } from './ui/AudioTools';
import css from './ui/styles.css?inline';
import { pageTheme } from './ui/theme';

export const AUDIO_ATTR = 'data-atveza-audio';
const HOST_TAG = 'atveza-audio-tools';
/** Closed in production (spec section 5); open only in the e2e build so Playwright can see inside. */
const SHADOW_MODE: ShadowRootMode = import.meta.env.WXT_E2E === '1' ? 'open' : 'closed';

export interface Injected {
  buttonHost: HTMLElement;
  overlayHost: HTMLElement;
  update: (known: KnownTranscript | null) => void;
  /** Re-reads the Zendesk theme (light/dark). */
  refreshTheme: () => void;
  remove: () => void;
}

/**
 * Adds the ⋯ button next to the player's download button (or in the corner of
 * the bubble) and a floating layer in <body> for the menu and the transcription
 * box (messages clip their content). Both live in closed shadow roots so Zendesk
 * CSS and ours never mix (spec section 5).
 */
export function inject(
  candidate: AudioCandidate,
  ctx: Omit<AudioContextInfo, 'player' | 'buttonHost' | 'overlayHost' | 'overlayRoot'>,
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

  const overlayHost = document.createElement(HOST_TAG);
  overlayHost.setAttribute('data-atveza-overlay', ctx.audioKey);
  const overlayRoot = overlayHost.attachShadow({ mode: SHADOW_MODE });
  addStyle(overlayRoot);
  document.body.appendChild(overlayHost);

  const fullCtx: AudioContextInfo = {
    ...ctx,
    player: candidate.player,
    buttonHost,
    overlayHost,
    overlayRoot,
  };
  const refreshTheme = () => {
    const theme = pageTheme();
    buttonHost.setAttribute('data-theme', theme);
    overlayHost.setAttribute('data-theme', theme);
  };
  refreshTheme();

  const draw = (k: KnownTranscript | null) =>
    render(<AudioTools ctx={fullCtx} known={k} />, buttonRoot);
  draw(known);

  return {
    buttonHost,
    overlayHost,
    update: draw,
    refreshTheme,
    remove: () => {
      render(null, buttonRoot);
      buttonHost.remove();
      overlayHost.remove();
      candidate.player.removeAttribute(AUDIO_ATTR);
    },
  };
}

function addStyle(root: ShadowRoot): void {
  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);
}
