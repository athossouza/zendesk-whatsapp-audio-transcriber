/**
 * Service worker (spec section 4): routes requests from content scripts and
 * extension pages to the offscreen document and progress back, downloads
 * audio by URL when needed, and manages the offscreen document lifecycle.
 */
import { defineBackground } from 'wxt/utils/define-background';
import { bytesToBase64 } from '@/src/shared/base64';
import { MAX_AUDIO_BYTES } from '@/entrypoints/offscreen/decode';
import {
  isOwnSender,
  OffscreenEventSchema,
  ProgressSchema,
  TRANSCRIBE_PORT,
  ToBackgroundSchema,
  type Progress,
  type ToOffscreen,
  type TranscribeRequest,
} from '@/src/shared/messages';
import { logError } from '@/src/shared/error-log';
import { loadSettings } from '@/src/shared/settings';
import { saveTranscript } from '@/src/shared/transcript-cache';

const OFFSCREEN_PATH = 'offscreen.html';

export default defineBackground({
  type: 'module',
  main() {
    /** requestId -> port of the page that asked. */
    const routes = new Map<string, chrome.runtime.Port>();
    let creating: Promise<void> | null = null;

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== TRANSCRIBE_PORT || port.sender?.id !== chrome.runtime.id) {
        port.disconnect();
        return;
      }
      const mine = new Set<string>();
      port.onMessage.addListener((raw: unknown) => {
        const parsed = ToBackgroundSchema.safeParse(raw);
        if (!parsed.success) return;
        const msg = parsed.data;
        if (msg.type === 'CANCEL') {
          void toOffscreen({ type: 'OFF_CANCEL', requestId: msg.requestId });
          return;
        }
        routes.set(msg.requestId, port);
        mine.add(msg.requestId);
        handleTranscribe(msg).catch((err: unknown) => {
          deliver({
            type: 'ERROR',
            requestId: msg.requestId,
            code: 'TRANSCRIBE_FAILED',
            detail: err instanceof Error ? err.message : String(err),
          });
        });
      });
      // Page closed or navigated: cancel what it was waiting for.
      port.onDisconnect.addListener(() => {
        for (const id of mine) {
          if (routes.get(id) === port) {
            routes.delete(id);
            void toOffscreen({ type: 'OFF_CANCEL', requestId: id });
          }
        }
      });
    });

    chrome.runtime.onMessage.addListener((raw: unknown, sender) => {
      if (!isOwnSender(sender) || sender.url !== chrome.runtime.getURL(OFFSCREEN_PATH)) return;
      if (OffscreenEventSchema.safeParse(raw).success) {
        if (!routes.size) void closeOffscreen();
        return;
      }
      const parsed = ProgressSchema.safeParse(raw);
      if (parsed.success) deliver(parsed.data);
    });

    function deliver(msg: Progress): void {
      const port = routes.get(msg.requestId);
      if (msg.type === 'DONE') {
        // Benchmarks and option-page tests use ticketId 0: not cached.
        if (msg.result.ticketId > 0) void saveTranscript(msg.result);
      }
      if (msg.type === 'ERROR') void logError(msg.code, msg.detail);
      if (msg.type === 'DONE' || msg.type === 'ERROR') routes.delete(msg.requestId);
      try {
        port?.postMessage(msg);
      } catch {
        // Port already closed.
      }
    }

    async function handleTranscribe(msg: TranscribeRequest): Promise<void> {
      const settings = await loadSettings();
      let base64 = msg.base64;
      let mime = msg.mime;
      if (!base64) {
        if (!msg.src || msg.src.startsWith('blob:')) {
          deliver({
            type: 'ERROR',
            requestId: msg.requestId,
            code: 'AUDIO_FETCH_FAILED',
            detail: 'no-bytes',
          });
          return;
        }
        const fetched = await fetchAudio(msg.src);
        if (!fetched) {
          deliver({ type: 'ERROR', requestId: msg.requestId, code: 'AUDIO_FETCH_FAILED' });
          return;
        }
        ({ base64, mime } = fetched);
      }
      await ensureOffscreen();
      await toOffscreen({
        type: 'OFF_TRANSCRIBE',
        requestId: msg.requestId,
        audioKey: msg.audioKey,
        ticketId: msg.ticketId,
        subdomain: msg.subdomain,
        base64,
        mime,
        model: msg.engine?.model ?? settings.model,
        device: msg.engine?.device ?? 'auto',
        dtype: msg.engine?.dtype,
        language: settings.language === 'auto' ? null : settings.language,
        maxAudioMinutes: settings.maxAudioMinutes,
        modelMirror: settings.modelMirror,
        replacements: settings.replacements,
        hallucinationFilters: settings.hallucinationFilters,
      });
    }

    /** Spec section 6, step 1: the service worker is not subject to CORS for host_permissions. */
    async function fetchAudio(src: string): Promise<{ base64: string; mime?: string } | null> {
      try {
        const res = await fetch(src, { credentials: 'include' });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_AUDIO_BYTES) return null;
        return { base64: bytesToBase64(buf), mime: res.headers.get('content-type') ?? undefined };
      } catch {
        return null;
      }
    }

    async function toOffscreen(msg: ToOffscreen): Promise<void> {
      if (msg.type === 'OFF_CANCEL' && !(await hasOffscreen())) return;
      await chrome.runtime.sendMessage(msg).catch(() => undefined);
    }

    async function hasOffscreen(): Promise<boolean> {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
      });
      return contexts.length > 0;
    }

    async function ensureOffscreen(): Promise<void> {
      if (await hasOffscreen()) return;
      creating ??= chrome.offscreen
        .createDocument({
          url: OFFSCREEN_PATH,
          reasons: [chrome.offscreen.Reason.WORKERS, chrome.offscreen.Reason.BLOBS],
          justification: 'Transcrição local de áudio com Whisper',
        })
        .finally(() => {
          creating = null;
        });
      await creating;
    }

    async function closeOffscreen(): Promise<void> {
      if (await hasOffscreen()) await chrome.offscreen.closeDocument();
    }
  },
});
