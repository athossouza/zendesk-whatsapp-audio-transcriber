import type { AudioCandidate, DetectionStrategy } from '@/entrypoints/content/detector';

/**
 * Discovery mode (spec section 5): describes how audios appear in the page,
 * without any customer data (texts masked, names and URLs reduced to patterns).
 */
export interface DiscoveryEntry {
  key: string;
  subdomain: string;
  ticketId: number | null;
  strategy: DetectionStrategy;
  src: { scheme: string; host: string; pathPattern: string } | null;
  hasAnchor: boolean;
  hasAuthor: boolean;
  hasTime: boolean;
  durationSeconds: number | null;
  /** Whether the content script could download the audio (bytes are discarded). */
  fetchProbe?: FetchProbe;
  chain: ElementInfo[];
  maskedHtml: string;
  seenAt: string;
}

export interface DiscoveryReport {
  generatedAt: string;
  extensionVersion: string;
  userAgent: string;
  entries: DiscoveryEntry[];
}

export interface FetchProbe {
  ok: boolean;
  status?: number;
  mime?: string | null;
  bytes?: number;
  error?: string;
}

/** Tries to download `src` from the current context. Only metadata is kept; the bytes are dropped. */
export async function probeFetch(
  src: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchProbe> {
  try {
    const res = await fetchImpl(src, { credentials: 'same-origin' });
    const buf = await res.arrayBuffer();
    return {
      ok: res.ok,
      status: res.status,
      mime: res.headers.get('content-type'),
      bytes: buf.byteLength,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.name : 'unknown' };
  }
}

export interface ElementInfo {
  tag: string;
  testId?: string;
  role?: string;
  ariaLabel?: string;
  classes?: string;
}

const MAX_CHAIN = 20;
const MAX_HTML = 8000;
/** Attributes kept as-is in the masked HTML: structural, never customer data. */
const SAFE_ATTRS = new Set([
  'data-test-id',
  'role',
  'type',
  'datetime',
  'tabindex',
  'preload',
  'controls',
]);
/** Attributes kept but with their value masked. */
const MASKED_ATTRS = new Set(['aria-label', 'title', 'alt', 'href', 'src', 'download']);

export function buildEntry(
  candidate: AudioCandidate,
  conversationRoot: Element | null,
  context: {
    subdomain: string;
    ticketId: number | null;
    index: number;
    safeLabels: readonly string[];
  },
): DiscoveryEntry {
  const src = describeSrc(candidate.src);
  const chain = elementChain(candidate.player, conversationRoot);
  return {
    key: [context.subdomain, context.ticketId, context.index, candidate.strategy].join('|'),
    subdomain: context.subdomain,
    ticketId: context.ticketId,
    strategy: candidate.strategy,
    src,
    hasAnchor: candidate.anchor !== null,
    hasAuthor: candidate.author !== null,
    hasTime: candidate.time !== null,
    durationSeconds: candidate.durationSeconds,
    chain,
    maskedHtml: maskHtml(candidate.bubble ?? candidate.player, context.safeLabels),
    seenAt: new Date().toISOString(),
  };
}

export function describeSrc(src: string | null): DiscoveryEntry['src'] {
  if (!src) return null;
  try {
    const url = new URL(src);
    if (url.protocol === 'blob:')
      return { scheme: 'blob', host: new URL(url.pathname).host, pathPattern: '/:uuid' };
    return {
      scheme: url.protocol.replace(':', ''),
      host: url.host,
      pathPattern: pathPattern(url.pathname),
    };
  } catch {
    return { scheme: 'unknown', host: '', pathPattern: '' };
  }
}

/** Replaces IDs in a path with `:id`, e.g. `/api/v2/ticket_attachments/01M7…/content` → `/api/v2/ticket_attachments/:id/content`. */
export function pathPattern(pathname: string): string {
  return pathname
    .split('/')
    .map((seg) => (/\d/.test(seg) && seg.length >= 6 ? ':id' : seg))
    .join('/');
}

export function elementChain(from: Element, stopAt: Element | null): ElementInfo[] {
  const chain: ElementInfo[] = [];
  for (let el: Element | null = from; el && chain.length < MAX_CHAIN; el = el.parentElement) {
    chain.push(describeElement(el));
    if (el === stopAt || el.tagName === 'BODY') break;
  }
  return chain;
}

function describeElement(el: Element): ElementInfo {
  const info: ElementInfo = { tag: el.tagName.toLowerCase() };
  const testId = el.getAttribute('data-test-id');
  const role = el.getAttribute('role');
  const aria = el.getAttribute('aria-label');
  const classes = el.getAttribute('class');
  if (testId) info.testId = testId;
  if (role) info.role = role;
  if (aria) info.ariaLabel = maskText(aria);
  if (classes) info.classes = classes.slice(0, 120);
  return info;
}

/** Clones `el` and strips anything that could identify a customer. */
export function maskHtml(el: Element, safeLabels: readonly string[]): string {
  const clone = el.cloneNode(true) as Element;
  const safe = new Set(safeLabels.map((s) => s.trim()));
  const doc = el.ownerDocument;

  for (const svg of clone.querySelectorAll('svg')) svg.replaceChildren();

  const walker = doc.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? '';
    if (!safe.has(value.trim()) && !isTimeOrUi(value.trim())) node.nodeValue = maskText(value);
  }

  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    for (const attr of [...node.attributes]) {
      if (SAFE_ATTRS.has(attr.name)) continue;
      if (MASKED_ATTRS.has(attr.name)) node.setAttribute(attr.name, maskText(attr.value));
      else node.removeAttribute(attr.name);
    }
  }

  const html = clone.outerHTML;
  return html.length > MAX_HTML ? `${html.slice(0, MAX_HTML)}<!-- truncated -->` : html;
}

/** Keeps player UI text such as "0:06 / 0:08" or "1x" readable. */
function isTimeOrUi(text: string): boolean {
  return /^(\d{1,2}:\d{2}(\s*\/\s*\d{1,2}:\d{2})?|\d(\.\d+)?x|[•·])$/.test(text);
}

export function maskText(text: string): string {
  return text.replace(/\S/g, '*');
}

/** Adds entries to a report, replacing older entries with the same key and capping the size. */
export function mergeEntries(
  existing: DiscoveryEntry[],
  incoming: DiscoveryEntry[],
  max = 50,
): DiscoveryEntry[] {
  const byKey = new Map(existing.map((e) => [e.key, e]));
  for (const entry of incoming) byKey.set(entry.key, entry);
  return [...byKey.values()].sort((a, b) => b.seenAt.localeCompare(a.seenAt)).slice(0, max);
}
