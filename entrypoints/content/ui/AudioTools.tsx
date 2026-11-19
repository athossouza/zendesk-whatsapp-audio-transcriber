import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDuration, formatMb } from '@/src/shared/format';
import { shortModelName } from '@/src/shared/models';
import { requestTranscription, type TranscribeHandle } from '@/src/shared/transcribe-client';
import { markSavedAsNote } from '@/src/shared/transcript-cache';
import {
  reduceProgress,
  stateLabel,
  type TranscriptionState,
} from '@/src/shared/transcription-state';
import { buildNoteBody, NoteError, noteErrorMessage, type ZendeskApi } from '../zendesk-api';
import { applyPlacement, placeMenu, placePanel, toBox } from './anchor';

export interface AudioContextInfo {
  audioKey: string;
  ticketId: number;
  subdomain: string;
  author: string | null;
  time: string | null;
  durationSeconds: number | null;
  getAudio: () => Promise<{ base64: string; mime?: string }>;
  api: ZendeskApi;
  /** The player: the box is placed next to it. */
  player: Element;
  /** Visible area of the conversation (floating UI hides outside it). */
  clip: () => Element | null;
  /** Host of the ⋯ button (inline, next to the download button). */
  buttonHost: HTMLElement;
  /** Floating layer (position: fixed, in <body>) for the menu and the box. */
  overlayHost: HTMLElement;
  overlayRoot: ShadowRoot;
  autoSaveNote: boolean;
}

export interface KnownTranscript {
  text: string;
  model: string | null;
  savedAsNote: boolean;
  /** Duration measured when decoding (reliable, unlike the player's). */
  audioSeconds: number | null;
}

type NoteState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'already' }
  | { kind: 'error'; message: string; retry: boolean };

export function AudioTools(props: { ctx: AudioContextInfo; known: KnownTranscript | null }) {
  const { ctx } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [state, setState] = useState<TranscriptionState>({ kind: 'idle' });
  const [known, setKnown] = useState<KnownTranscript | null>(props.known);
  const [note, setNote] = useState<NoteState>(
    props.known?.savedAsNote ? { kind: 'saved' } : { kind: 'idle' },
  );
  const handle = useRef<TranscribeHandle | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLUListElement>(null);

  const busy = !['idle', 'done', 'error'].includes(state.kind);
  const text = known?.text ?? null;

  useEffect(() => setKnown(props.known), [props.known]);
  useEffect(() => {
    if (menuOpen) firstItem.current?.focus();
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    // With closed shadow roots, composedPath() seen from the document stops at the
    // hosts, so compare against the hosts, not inner elements.
    const close = (e: Event) => {
      const path = e.composedPath();
      if (!path.includes(ctx.buttonHost) && !path.includes(ctx.overlayHost)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [menuOpen]);
  // Cancel if the audio leaves the page (component unmounted).
  useEffect(() => () => handle.current?.cancel(), []);

  // Keep the floating menu/box attached to the player while the conversation scrolls.
  useEffect(() => {
    if (!menuOpen && !panelOpen) return;
    let frame = 0;
    const tick = () => {
      if (!ctx.player.isConnected) {
        setMenuOpen(false);
        setPanelOpen(false);
        return;
      }
      const clipEl = ctx.clip();
      const clip = toBox((clipEl ?? document.documentElement).getBoundingClientRect());
      const vh = window.innerHeight;
      if (panel.current)
        applyPlacement(
          panel.current,
          placePanel(toBox(ctx.player.getBoundingClientRect()), clip, vh),
        );
      if (menu.current && button.current) {
        applyPlacement(
          menu.current,
          placeMenu(
            toBox(button.current.getBoundingClientRect()),
            clip,
            menu.current.offsetHeight,
            vh,
          ),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [menuOpen, panelOpen]);

  const closePanel = () => {
    handle.current?.cancel();
    setPanelOpen(false);
    button.current?.focus();
  };

  // Buttons that disappear (e.g. "Salvar" after saving) would drop focus to <body>:
  // keep it inside the box so Tab and Esc keep working.
  useEffect(() => {
    if (!panelOpen) return;
    const active =
      panel.current?.getRootNode() instanceof ShadowRoot
        ? (panel.current.getRootNode() as ShadowRoot).activeElement
        : null;
    if (!active) panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [panelOpen, note.kind, state.kind]);

  // Esc also closes the box when nothing on the page has focus.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const idle = !document.activeElement || document.activeElement === document.body;
      if (e.key === 'Escape' && idle) closePanel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // closePanel only touches refs and setters.
  }, [panelOpen]);

  const transcribe = async () => {
    setMenuOpen(false);
    setPanelOpen(true);
    setNote({ kind: 'idle' });
    let current: TranscriptionState = { kind: 'decoding' };
    setState(current);
    let audio: { base64: string; mime?: string };
    try {
      audio = await ctx.getAudio();
    } catch {
      setState({
        kind: 'error',
        message: 'Não consegui acessar este áudio. Recarregue o ticket e tente de novo.',
      });
      return;
    }
    handle.current = requestTranscription(
      {
        audioKey: ctx.audioKey,
        ticketId: ctx.ticketId,
        subdomain: ctx.subdomain,
        base64: audio.base64,
        mime: audio.mime,
      },
      (p) => {
        current = reduceProgress(current, p);
        setState(current);
        if (p.type === 'ERROR' && p.code === 'CANCELLED') setPanelOpen(false);
      },
    );
    const out = await handle.current.done;
    handle.current = null;
    if (out.type === 'DONE' && out.result.text) {
      const next: KnownTranscript = {
        text: out.result.text,
        model: out.result.model,
        savedAsNote: false,
        audioSeconds: out.result.audioSeconds,
      };
      setKnown(next);
      if (ctx.autoSaveNote) void saveNote(next);
    }
  };

  const saveNote = async (t: KnownTranscript | null = known) => {
    if (!t) return;
    setNote({ kind: 'saving' });
    try {
      const existing = await ctx.api.listTranscriptNotes(ctx.ticketId);
      if (existing.has(ctx.audioKey)) {
        setNote({ kind: 'already' });
        return;
      }
      await ctx.api.saveInternalNote(
        ctx.ticketId,
        buildNoteBody({
          author: ctx.author,
          time: ctx.time,
          durationSeconds: t.audioSeconds ?? ctx.durationSeconds,
          text: t.text,
          model: t.model ?? 'whisper',
          audioKey: ctx.audioKey,
        }),
      );
      await markSavedAsNote(ctx.audioKey);
      setKnown({ ...t, savedAsNote: true });
      setNote({ kind: 'saved' });
    } catch (err) {
      const kind = err instanceof NoteError ? err.kind : 'SERVER';
      setNote({
        kind: 'error',
        message: noteErrorMessage(kind),
        retry: kind !== 'FORBIDDEN' && kind !== 'UNPROCESSABLE',
      });
    }
  };

  const copy = async () => {
    if (text) await navigator.clipboard.writeText(text);
  };

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setMenuOpen(false);
      button.current?.focus();
    }
  };

  const onPanelKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closePanel();
    }
  };

  // While (re)transcribing, show only the new text, never the previous one.
  const showText = state.kind === 'transcribing' ? state.text : busy ? null : text;

  return (
    <div class="more">
      <button
        ref={button}
        type="button"
        class="more-btn"
        aria-label="Mais ações do áudio"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="Transcrever áudio"
        onClick={() => {
          if (panelOpen) closePanel();
          else setMenuOpen(!menuOpen);
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="13" cy="8" r="1.5" fill="currentColor" />
        </svg>
        {text && <span class="dot" aria-hidden="true" />}
      </button>

      {menuOpen &&
        createPortal(
          <ul ref={menu} class="menu" role="menu" onKeyDown={onMenuKey}>
            <li role="none">
              <button
                ref={firstItem}
                type="button"
                role="menuitem"
                class="item"
                onClick={() => {
                  if (text) {
                    setMenuOpen(false);
                    setPanelOpen(true);
                  } else void transcribe();
                }}
              >
                {text ? 'Ver transcrição' : 'Transcrever'}
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                class="item"
                disabled={!text}
                onClick={() => {
                  void copy();
                  setMenuOpen(false);
                }}
              >
                Copiar transcrição
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                class="item"
                disabled={!text || note.kind === 'saved'}
                onClick={() => {
                  setMenuOpen(false);
                  setPanelOpen(true);
                  void saveNote();
                }}
              >
                Salvar como nota interna
              </button>
            </li>
          </ul>,
          ctx.overlayRoot as unknown as Element,
        )}

      {panelOpen &&
        createPortal(
          <div
            ref={panel}
            class="panel"
            role="dialog"
            aria-label="Transcrição do áudio"
            aria-modal="false"
            onKeyDown={onPanelKey}
          >
            <div class="head">
              <strong>Transcrição</strong>
              <span>
                {headerDetails(known?.audioSeconds ?? ctx.durationSeconds, known?.model ?? null)}
              </span>
            </div>

            <div class="body" aria-live="polite">
              {busy && state.kind !== 'transcribing' && (
                <div class="status">
                  {stateLabel(state)}
                  {state.kind === 'downloading' &&
                    state.totalBytes > 0 &&
                    ` · ${formatMb(state.loadedBytes)} de ${formatMb(state.totalBytes)}`}
                  {state.kind === 'downloading' && state.totalBytes > 0 && (
                    <progress value={state.loadedBytes} max={state.totalBytes} />
                  )}
                </div>
              )}
              {showText && (
                <span class={state.kind === 'transcribing' ? 'typing' : ''}>{showText}</span>
              )}
              {state.kind === 'transcribing' && !showText && (
                <span class="status typing">Transcrevendo</span>
              )}
              {state.kind === 'error' && <div class="status error">{state.message}</div>}
            </div>

            {note.kind === 'saving' && <div class="status">Salvando no ticket…</div>}
            {note.kind === 'saved' && <div class="status ok">✓ Salva no ticket</div>}
            {note.kind === 'already' && <div class="status ok">✓ Já salva neste ticket</div>}
            {note.kind === 'error' && <div class="status error">{note.message}</div>}

            <div class="actions">
              {busy && (
                <button type="button" class="btn" onClick={closePanel}>
                  Cancelar
                </button>
              )}
              {!busy && text && (
                <>
                  <button type="button" class="btn" onClick={() => void copy()}>
                    Copiar
                  </button>
                  {note.kind !== 'saved' && note.kind !== 'already' && (
                    <button
                      type="button"
                      class="btn primary"
                      disabled={note.kind === 'saving' || (note.kind === 'error' && !note.retry)}
                      onClick={() => void saveNote()}
                    >
                      Salvar como nota interna
                    </button>
                  )}
                  <button type="button" class="btn" onClick={() => void transcribe()}>
                    Transcrever de novo
                  </button>
                </>
              )}
              {!busy && state.kind === 'error' && (
                <button type="button" class="btn" onClick={() => void transcribe()}>
                  Tentar de novo
                </button>
              )}
              {!busy && (
                <button type="button" class="btn" onClick={closePanel}>
                  Fechar
                </button>
              )}
            </div>
            <div class="foot">Gerado por IA no seu computador. Confira antes de usar.</div>
          </div>,
          ctx.overlayRoot as unknown as Element,
        )}
    </div>
  );
}

function headerDetails(seconds: number | null, model: string | null): string {
  return [seconds === null ? null : formatDuration(seconds), model && shortModelName(model)]
    .filter(Boolean)
    .join(' · ');
}
