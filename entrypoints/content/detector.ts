import { joinSelectors, type Selectors } from '@/src/shared/selectors';

export type DetectionStrategy = 'audio-element' | 'audio-container' | 'audio-link' | 'text-label';

/** One audio found in the conversation (spec section 5). */
export interface AudioCandidate {
  strategy: DetectionStrategy;
  /** The player (or link/label) element the audio belongs to. */
  player: Element;
  /** The message bubble around the player, if found. */
  bubble: Element | null;
  /** Audio file URL (`blob:` or https), if known. */
  src: string | null;
  /** Download button of the player: preferred insertion point for the ⋯ button. */
  anchor: Element | null;
  author: string | null;
  /** ISO 8601 timestamp of the message, if found. */
  time: string | null;
  /** Duration in seconds, if the <audio> already loaded its metadata. */
  durationSeconds: number | null;
}

/** Returns the conversation root, or null when none of the configured roots exists. */
export function findConversationRoot(doc: Document, selectors: Selectors): Element | null {
  for (const selector of selectors.conversationRoot) {
    const sel = joinSelectors([selector], doc);
    const el = sel ? doc.querySelector(sel) : null;
    if (el) return el;
  }
  return null;
}

/**
 * Finds every audio in `root`, trying the strategies in order of preference and
 * never reporting the same player twice.
 */
export function detectAudios(root: ParentNode, selectors: Selectors): AudioCandidate[] {
  const doc = (root as Node).ownerDocument ?? (root as Document);
  const found: AudioCandidate[] = [];
  const claimed = new Set<Element>();

  const containerSel = joinSelectors(selectors.audioContainers, doc);
  const bubbleSel = joinSelectors(selectors.messageBubble, doc);

  const isClaimed = (el: Element): boolean => {
    for (const c of claimed) if (c === el || c.contains(el) || el.contains(c)) return true;
    return false;
  };

  const add = (strategy: DetectionStrategy, player: Element, src: string | null): void => {
    if (isClaimed(player)) return;
    claimed.add(player);
    const bubble = bubbleSel ? player.closest(bubbleSel) : null;
    const audio = player instanceof HTMLAudioElement ? player : player.querySelector('audio');
    found.push({
      strategy,
      player,
      bubble,
      src: src ?? audioSrc(audio),
      anchor: findFirst(player, selectors.downloadButton, doc),
      author: textOf(bubble && findFirst(bubble, selectors.messageAuthor, doc)),
      time: timeOf(bubble && findFirst(bubble, selectors.messageTime, doc)),
      durationSeconds:
        audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null,
    });
  };

  // 1. <audio> elements.
  const audioSel = joinSelectors(selectors.audioElements, doc);
  if (audioSel) {
    for (const el of root.querySelectorAll(audioSel)) {
      const audio = el instanceof HTMLAudioElement ? el : el.closest('audio');
      if (!audio) continue;
      const player = (containerSel && audio.closest(containerSel)) || audio.parentElement || audio;
      add('audio-element', player, audioSrc(audio));
    }
  }

  // 2. Zendesk player containers (also covers players whose <audio> is not mounted yet).
  if (containerSel) {
    for (const el of root.querySelectorAll(containerSel)) add('audio-container', el, null);
  }

  // 3. Links to audio files.
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (isAudioLink(link, selectors.audioLinkExtensions)) add('audio-link', link, link.href);
  }

  // 4. Text labels ("Gravação de WhatsApp") inside a bubble that has a button.
  if (bubbleSel && selectors.textLabels.length) {
    const labels = new Set(selectors.textLabels.map((l) => l.toLowerCase()));
    const walker = doc.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue?.trim().toLowerCase();
      if (!text || !labels.has(text)) continue;
      const bubble = node.parentElement?.closest(bubbleSel);
      if (bubble?.querySelector('button')) add('text-label', bubble, null);
    }
  }

  return found;
}

export function isAudioLink(link: HTMLAnchorElement, extensions: readonly string[]): boolean {
  const type = link.getAttribute('type') ?? '';
  if (type.toLowerCase().startsWith('audio/')) return true;
  let pathname: string;
  try {
    pathname = new URL(link.href, link.ownerDocument.baseURI).pathname.toLowerCase();
  } catch {
    return false;
  }
  const download = (link.getAttribute('download') ?? '').toLowerCase();
  return extensions.some((ext) => pathname.endsWith(`.${ext}`) || download.endsWith(`.${ext}`));
}

function audioSrc(audio: HTMLAudioElement | null): string | null {
  if (!audio) return null;
  return (
    audio.currentSrc ||
    audio.getAttribute('src') ||
    audio.querySelector('source[src]')?.getAttribute('src') ||
    null
  );
}

function findFirst(scope: Element, list: readonly string[], doc: Document): Element | null {
  for (const selector of list) {
    const sel = joinSelectors([selector], doc);
    const el = sel ? scope.querySelector(sel) : null;
    if (el) return el;
  }
  return null;
}

function textOf(el: Element | null): string | null {
  const text = el?.textContent?.replace(/\s+/g, ' ').trim();
  return text || null;
}

function timeOf(el: Element | null): string | null {
  return el?.getAttribute('datetime') ?? null;
}
