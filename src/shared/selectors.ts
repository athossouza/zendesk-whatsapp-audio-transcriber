import { z } from './zod';
import defaults from './selectors.default.json';

const SelectorList = z.array(z.string().min(1).max(300)).max(30);

/**
 * Data-only description of where audios live in the Agent Workspace DOM.
 * Never contains code (Chrome Web Store forbids remote code in MV3).
 */
export const SelectorsSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string(),
  conversationRoot: SelectorList,
  audioElements: SelectorList,
  audioContainers: SelectorList,
  audioLinkExtensions: z.array(z.string().regex(/^[a-z0-9]{2,5}$/)).max(30),
  textLabels: z.array(z.string().min(1).max(100)).max(30),
  downloadButton: SelectorList,
  messageBubble: SelectorList,
  messageAuthor: SelectorList,
  messageTime: SelectorList,
});

export type Selectors = z.infer<typeof SelectorsSchema>;

export const DEFAULT_SELECTORS: Selectors = SelectorsSchema.parse(defaults);

/** Joins a selector list into one CSS selector, dropping entries the browser rejects. */
export function joinSelectors(list: readonly string[], doc: Document = document): string | null {
  const valid = list.filter((s) => isValidSelector(s, doc));
  return valid.length ? valid.join(', ') : null;
}

function isValidSelector(selector: string, doc: Document): boolean {
  try {
    doc.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * Accepts a candidate (e.g. remote) config only if it is valid and newer.
 * Returns the config that should be used.
 */
export function pickSelectors(current: Selectors, candidate: unknown): Selectors {
  const parsed = SelectorsSchema.safeParse(candidate);
  if (!parsed.success) return current;
  return parsed.data.version > current.version ? parsed.data : current;
}
