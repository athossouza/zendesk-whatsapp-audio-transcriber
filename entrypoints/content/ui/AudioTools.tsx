import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDuration, formatMb, toParagraphs } from '@/src/shared/format';
import { shortModelName } from '@/src/shared/models';
import { requestTranscription, type TranscribeHandle } from '@/src/shared/transcribe-client';
import { markSavedAsNote } from '@/src/shared/transcript-cache';
import {
  reduceProgress,
  stateLabel,
  type TranscriptionState,
} from '@/src/shared/transcription-state';
import { buildNoteBody, NoteError, noteErrorMessage, type ZendeskApi } from '../zendesk-api';
import {
  applyManual,
  applyPlacement,
  clampRect,
  clampSize,
  placeMenu,
  placePanel,
  toBox,
  type ManualRect,
} from './anchor';
import {
  IconCheck,
  IconClose,
  IconCopy,
  IconInfo,
  IconLocate,
  IconMore,
  IconNote,
  IconTranscript,
} from './icons';

const PANEL_SIZE_KEY = 'panelSize';

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
  const [copied, setCopied] = useState(false);
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
  /** Outline drawn over the source audio while its box is open (link box ↔ audio). */
  const ring = useRef<HTMLDivElement>(null);
  const [linkStrong, setLinkStrong] = useState(false);
  const [pulse, setPulse] = useState(false);
  /** Set once the agent drags or resizes the box: it then stays put in the window. */
  const manual = useRef<ManualRect | null>(null);
  /** Size the agent chose last time (remembered across audios and sessions). */
  const savedSize = useRef<{ width: number; height: number | null } | null>(null);
  const gesture = useRef<{
    mode: 'move' | 'resize';
    x: number;
    y: number;
    start: ManualRect;
  } | null>(null);
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
      const vw = window.innerWidth;
      if (ring.current) {
        const r = ctx.player.getBoundingClientRect();
        const onScreen = r.bottom > clip.top && r.top < clip.bottom && r.height > 0;
        Object.assign(ring.current.style, {
          display: onScreen ? '' : 'none',
          left: `${r.left - 4}px`,
          top: `${r.top - 4}px`,
          width: `${r.width + 8}px`,
          height: `${r.height + 8}px`,
        });
      }
      if (panel.current) {
        if (manual.current) {
          manual.current = clampRect(manual.current, vw, vh);
          applyManual(panel.current, manual.current, vh);
        } else {
          const placement = placePanel(toBox(ctx.player.getBoundingClientRect()), clip, vh);
          const size =
            savedSize.current &&
            clampSize(savedSize.current.width, savedSize.current.height, vw, vh);
          if (size) placement.width = size.width;
          applyPlacement(panel.current, placement);
          panel.current.style.height =
            size?.height != null ? `${Math.min(size.height, placement.maxHeight)}px` : '';
        }
      }
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

  // Remembered box size (per agent, in this browser).
  useEffect(() => {
    try {
      void chrome.storage.local
        .get(PANEL_SIZE_KEY)
        .then((r) => {
          const v = r[PANEL_SIZE_KEY] as { width?: unknown; height?: unknown } | undefined;
          if (v && typeof v.width === 'number') {
            savedSize.current = {
              width: v.width,
              height: typeof v.height === 'number' ? v.height : null,
            };
          }
        })
        .catch(() => undefined);
    } catch {
      // Extension context gone: keep defaults.
    }
  }, []);

  const startGesture = (mode: 'move' | 'resize') => (e: PointerEvent) => {
    if (e.button !== 0 || !panel.current) return;
    // Clicks on the header's own controls are not drags.
    if (mode === 'move' && (e.target as Element).closest('button, .info')) return;
    e.preventDefault();
    const r = panel.current.getBoundingClientRect();
    const start: ManualRect = {
      left: r.left,
      top: r.top,
      width: r.width,
      height:
        mode === 'resize'
          ? r.height
          : (manual.current?.height ?? savedSize.current?.height ?? null),
    };
    manual.current = start;
    gesture.current = { mode, x: e.clientX, y: e.clientY, start };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const moveGesture = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    manual.current =
      g.mode === 'move'
        ? { ...g.start, left: g.start.left + dx, top: g.start.top + dy }
        : { ...g.start, width: g.start.width + dx, height: (g.start.height ?? 0) + dy };
  };

  const endGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.mode === 'resize' && manual.current) {
      savedSize.current = { width: manual.current.width, height: manual.current.height };
      try {
        void chrome.storage.local
          .set({ [PANEL_SIZE_KEY]: savedSize.current })
          .catch(() => undefined);
      } catch {
        // Extension context gone: size is kept for this page only.
      }
    }
  };

  /** Scrolls the conversation to the source audio and makes its outline pulse. */
  const locateAudio = () => {
    ctx.player.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setPulse(true);
    setTimeout(() => setPulse(false), 1400);
  };

  /** Double-click on the header: back next to the audio, default size. */
  const resetPanel = () => {
    manual.current = null;
    savedSize.current = null;
    try {
      void chrome.storage.local.remove(PANEL_SIZE_KEY).catch(() => undefined);
    } catch {
      // ignore
    }
  };

  const closePanel = () => {
    handle.current?.cancel();
    manual.current = null;
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
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  const seconds = known?.audioSeconds ?? ctx.durationSeconds;
  const duration = seconds === null ? null : formatDuration(seconds);
  // Which audio this box belongs to: sender, message time and duration.
  const sentAt = ctx.time
    ? new Date(ctx.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;
  const source = [ctx.author, sentAt, duration].filter(Boolean).join(' · ');
  const disclaimer = `Gerado por IA no seu computador${
    known?.model ? ` (${shortModelName(known.model)})` : ''
  }. Confira antes de usar.`;
  const canSave = !busy && !!text && note.kind !== 'saved' && note.kind !== 'already';

  return (
    <div class="more">
      <button
        ref={button}
        type="button"
        class={`icon-btn more-btn${panelOpen ? ' open' : ''}`}
        aria-label="Mais ações do áudio"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={text ? 'Transcrição disponível' : 'Transcrever áudio'}
        onClick={() => {
          if (panelOpen) closePanel();
          else setMenuOpen(!menuOpen);
        }}
      >
        <IconMore />
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
                <IconTranscript />
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
                <IconCopy />
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
                <IconNote />
                Salvar como nota interna
              </button>
            </li>
          </ul>,
          ctx.overlayRoot as unknown as Element,
        )}

      {panelOpen &&
        createPortal(
          <div
            ref={ring}
            class={`source-ring${linkStrong ? ' strong' : ''}${pulse ? ' pulse' : ''}`}
            aria-hidden="true"
          />,
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
            onPointerEnter={() => setLinkStrong(true)}
            onPointerLeave={() => setLinkStrong(false)}
            onFocusIn={() => setLinkStrong(true)}
            onFocusOut={() => setLinkStrong(false)}
          >
            <header
              class="head"
              title="Arraste para mover · clique duplo para voltar ao lugar"
              onPointerDown={startGesture('move')}
              onPointerMove={moveGesture}
              onPointerUp={endGesture}
              onLostPointerCapture={endGesture}
              onDblClick={resetPanel}
            >
              <span class="title">
                Transcrição
                {source && (
                  <span class="meta" title={source}>
                    {source}
                  </span>
                )}
                <span
                  class="info"
                  tabIndex={0}
                  role="img"
                  aria-label={disclaimer}
                  title={disclaimer}
                >
                  <IconInfo />
                </span>
              </span>
              <span class="tools">
                <button
                  type="button"
                  class="close"
                  aria-label="Mostrar o áudio na conversa"
                  title="Mostrar o áudio na conversa"
                  onClick={locateAudio}
                >
                  <IconLocate />
                </button>
                <button
                  type="button"
                  class="close"
                  aria-label={busy ? 'Cancelar' : 'Fechar'}
                  title={busy ? 'Cancelar' : 'Fechar'}
                  onClick={closePanel}
                >
                  <IconClose />
                </button>
              </span>
            </header>

            <div class="body" aria-live="polite">
              {busy && state.kind !== 'transcribing' && (
                <div class="status">
                  <span class="spinner" aria-hidden="true" />
                  <span>
                    {stateLabel(state)}
                    {state.kind === 'downloading' &&
                      state.totalBytes > 0 &&
                      ` · ${formatMb(state.loadedBytes)} de ${formatMb(state.totalBytes)}`}
                  </span>
                </div>
              )}
              {state.kind === 'downloading' && state.totalBytes > 0 && (
                <progress value={state.loadedBytes} max={state.totalBytes} />
              )}
              {showText && (
                <div class={state.kind === 'transcribing' ? 'text typing' : 'text'}>
                  {toParagraphs(showText).map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              )}
              {state.kind === 'transcribing' && !showText && (
                <div class="status">
                  <span class="spinner" aria-hidden="true" />
                  <span>Transcrevendo</span>
                </div>
              )}
              {state.kind === 'error' && <div class="status error">{state.message}</div>}
            </div>

            <footer class="foot">
              {busy && (
                <button type="button" class="link" onClick={closePanel}>
                  Cancelar
                </button>
              )}
              {!busy && text && (
                <button type="button" class="link" onClick={() => void copy()}>
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              )}
              {!busy && (text || state.kind === 'error') && (
                <button type="button" class="link" onClick={() => void transcribe()}>
                  {state.kind === 'error' ? 'Tentar de novo' : 'Transcrever de novo'}
                </button>
              )}
              <span class="spacer" />
              {note.kind === 'saving' && (
                <span class="note-state">
                  <span class="spinner" aria-hidden="true" />
                  Salvando…
                </span>
              )}
              {note.kind === 'saved' && (
                <span class="note-state ok">
                  <IconCheck /> Salva no ticket
                </span>
              )}
              {note.kind === 'already' && (
                <span class="note-state ok">
                  <IconCheck /> Já salva neste ticket
                </span>
              )}
              {note.kind === 'error' && <span class="note-state error">{note.message}</span>}
              {canSave && note.kind !== 'saving' && (
                <button
                  type="button"
                  class="link strong"
                  disabled={note.kind === 'error' && !note.retry}
                  onClick={() => void saveNote()}
                >
                  Salvar como nota interna
                </button>
              )}
            </footer>
            <div
              class="resizer"
              aria-hidden="true"
              title="Arraste para redimensionar"
              onPointerDown={startGesture('resize')}
              onPointerMove={moveGesture}
              onPointerUp={endGesture}
              onLostPointerCapture={endGesture}
            />
          </div>,
          ctx.overlayRoot as unknown as Element,
        )}
    </div>
  );
}
