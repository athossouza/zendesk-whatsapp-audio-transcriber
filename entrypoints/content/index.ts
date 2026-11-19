import { defineContentScript } from 'wxt/utils/define-content-script';
import { appendDiscoveryEntries } from '@/src/shared/discovery-store';
import { DEFAULT_SELECTORS } from '@/src/shared/selectors';
import { loadSettings, type Settings } from '@/src/shared/settings';
import { parseSubdomain, parseTicketId } from '@/src/shared/zendesk-url';
import { detectAudios, findConversationRoot } from './detector';
import { buildEntry, probeFetch } from '@/src/shared/discovery';
import { watchPage } from './page-watcher';

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
  if (!subdomain || !settings.allowedSubdomains.includes(subdomain) || !settings.enabled) return;

  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') void loadSettings().then((s) => (settings = s));
  });

  const selectors = DEFAULT_SELECTORS;
  const reported = new WeakSet<Element>();

  const scan = (): void => {
    try {
      runScan(subdomain, settings, reported);
    } catch (err) {
      console.warn(LOG_PREFIX, 'scan failed', err);
    }
  };

  function runScan(sub: string, s: Settings, seen: WeakSet<Element>): void {
    const ticketId = parseTicketId(location.pathname);
    if (ticketId === null) return;
    const root = findConversationRoot(document, selectors);
    const candidates = detectAudios(root ?? document.body, selectors);

    if (s.discoveryMode) {
      const fresh = candidates.filter((c) => !seen.has(c.player));
      if (!fresh.length) return;
      const entries = fresh.map((c) => {
        seen.add(c.player);
        return buildEntry(c, root, {
          subdomain: sub,
          ticketId,
          index: candidates.indexOf(c),
          safeLabels: selectors.textLabels,
        });
      });
      void Promise.all(
        fresh.map(async (c, i) => {
          const entry = entries[i];
          if (!entry) return null;
          if (c.src) entry.fetchProbe = await probeFetch(c.src);
          console.info(LOG_PREFIX, 'discovery', entry);
          return entry;
        }),
      ).then((done) => appendDiscoveryEntries(done.filter((e) => e !== null)));
      return;
    }

    if (s.debug) console.debug(LOG_PREFIX, `ticket ${ticketId}: ${candidates.length} audio(s)`);
    // Phase 2: inject the ⋯ button for each candidate.
  }

  watchPage(window, {
    onScan: scan,
    onNavigate: (path) => {
      if (settings.debug) console.debug(LOG_PREFIX, 'navigated', path);
    },
  });
}
