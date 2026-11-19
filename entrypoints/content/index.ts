import { defineContentScript } from 'wxt/utils/define-content-script';
import { computeAudioKey } from '@/src/shared/audio-key';
import { bytesToBase64 } from '@/src/shared/base64';
import { buildEntry, probeFetch } from '@/src/shared/discovery';
import { appendDiscoveryEntries } from '@/src/shared/discovery-store';
import { DEFAULT_SELECTORS } from '@/src/shared/selectors';
import { loadSettings } from '@/src/shared/settings';
import { getTranscripts } from '@/src/shared/transcript-cache';
import { parseSubdomain, parseTicketId } from '@/src/shared/zendesk-url';
import { detectAudios, findConversationRoot, type AudioCandidate } from './detector';
import { inject, type Injected } from './injector';
import { watchPage } from './page-watcher';
import type { KnownTranscript } from './ui/AudioTools';
import { ZendeskApi } from './zendesk-api';

const LOG_PREFIX = '[atveza]';

export default defineContentScript({
  // Real matches are injected per client in wxt.config.ts (build:manifestGenerated).
  matches: ['https://*.zendesk.com/agent/*'],
  runAt: 'document_idle',
  allFrames: false,
  async main() {
    try {
      await start();
    } catch (err) {
      // Never break the Zendesk page.
      console.warn(LOG_PREFIX, 'failed to start', err);
    }
  },
});

async function start(): Promise<void> {
  const subdomain = parseSubdomain(location.hostname);
  let settings = await loadSettings();
  if (!subdomain || !settings.allowedSubdomains.includes(subdomain)) return;

  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') void loadSettings().then((s) => (settings = s));
  });

  const selectors = DEFAULT_SELECTORS;
  const api = new ZendeskApi();
  const reported = new WeakSet<Element>();
  const injected = new Map<Element, Injected>();
  const pending = new WeakSet<Element>();
  /** Notes with the extension marker, per ticket (spec section 8). */
  const notesByTicket = new Map<number, Promise<Map<string, string>>>();

  const log = (...args: unknown[]) => settings.debug && console.debug(LOG_PREFIX, ...args);

  const scan = (): void => {
    try {
      runScan();
    } catch (err) {
      console.warn(LOG_PREFIX, 'scan failed', err);
    }
  };

  function runScan(): void {
    // Drop UI of audios that left the page (or whose hosts Zendesk re-rendered away).
    for (const [player, item] of injected) {
      if (!player.isConnected || !item.buttonHost.isConnected || !item.overlayHost.isConnected) {
        item.remove();
        injected.delete(player);
      } else {
        item.refreshTheme();
      }
    }

    const ticketId = parseTicketId(location.pathname);
    if (ticketId === null || !subdomain) return;
    const root = findConversationRoot(document, selectors);
    const candidates = detectAudios(root ?? document.body, selectors);

    if (settings.discoveryMode) {
      reportDiscovery(candidates, root, ticketId);
      return;
    }
    if (!settings.enabled) return;

    for (const c of candidates) {
      if (injected.has(c.player) || pending.has(c.player)) continue;
      pending.add(c.player);
      const index = candidates.filter((o) => o.bubble && o.bubble === c.bubble).indexOf(c);
      void setup(c, ticketId, Math.max(0, index)).finally(() => pending.delete(c.player));
    }
    log(`ticket ${ticketId}: ${candidates.length} audio(s)`);
  }

  async function setup(c: AudioCandidate, ticketId: number, index: number): Promise<void> {
    if (!subdomain) return;
    const duration = c.durationSeconds;
    const audioKey = await computeAudioKey({
      subdomain,
      ticketId,
      time: c.time,
      index,
      url: c.src,
    });
    if (!c.player.isConnected || injected.has(c.player)) return;

    const known = await findKnown(ticketId, audioKey, false);
    const item = inject(
      c,
      {
        audioKey,
        ticketId,
        subdomain,
        author: c.author,
        time: c.time,
        durationSeconds: duration,
        getAudio: () => readAudio(c),
        api,
        autoSaveNote: settings.autoSaveNote,
        clip: () => findConversationRoot(document, selectors),
      },
      known,
    );
    injected.set(c.player, item);

    // Notes saved by other agents/devices: check once per ticket, then update the button.
    if (!known) {
      void findKnown(ticketId, audioKey, true).then((k) => k && item.update(k));
    }
  }

  async function findKnown(
    ticketId: number,
    audioKey: string,
    checkNotes: boolean,
  ): Promise<KnownTranscript | null> {
    const cached = (await getTranscripts([audioKey]))[audioKey];
    if (cached)
      return {
        text: cached.text,
        model: cached.model,
        savedAsNote: cached.savedAsNote,
        audioSeconds: cached.audioSeconds,
      };
    if (!checkNotes) return null;
    let notes = notesByTicket.get(ticketId);
    if (!notes) {
      notes = api.listTranscriptNotes(ticketId).catch(() => new Map<string, string>());
      notesByTicket.set(ticketId, notes);
    }
    const text = (await notes).get(audioKey);
    return text ? { text, model: null, savedAsNote: true, audioSeconds: null } : null;
  }

  /** Spec section 6, step 2: read the player's blob: URL from the page context. */
  async function readAudio(c: AudioCandidate): Promise<{ base64: string; mime?: string }> {
    const audio = c.player instanceof HTMLAudioElement ? c.player : c.player.querySelector('audio');
    const src = audio?.currentSrc || audio?.getAttribute('src') || c.src;
    if (!src) throw new Error('no-src');
    const res = await fetch(src, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return { base64: bytesToBase64(buf), mime: res.headers.get('content-type') ?? undefined };
  }

  function reportDiscovery(
    candidates: AudioCandidate[],
    root: Element | null,
    ticketId: number,
  ): void {
    if (!subdomain) return;
    const fresh = candidates.filter((c) => !reported.has(c.player));
    if (!fresh.length) return;
    void Promise.all(
      fresh.map(async (c) => {
        reported.add(c.player);
        const entry = buildEntry(c, root, {
          subdomain,
          ticketId,
          index: candidates.indexOf(c),
          safeLabels: selectors.textLabels,
        });
        if (c.src) entry.fetchProbe = await probeFetch(c.src);
        console.info(LOG_PREFIX, 'discovery', entry);
        return entry;
      }),
    ).then(appendDiscoveryEntries);
  }

  watchPage(window, {
    onScan: scan,
    onNavigate: (path) => {
      log('navigated', path);
      notesByTicket.clear();
    },
  });
}
