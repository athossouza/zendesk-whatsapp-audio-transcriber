export interface PostprocessOptions {
  hallucinationFilters: readonly string[];
  replacements: readonly { from: string; to: string }[];
}

/**
 * Cleans Whisper output (spec section 7, "Pós-processamento do texto"):
 * known silence hallucinations, repeated sentences, client dictionary.
 * Returns an empty string when nothing meaningful is left.
 */
export function postprocess(raw: string, opts: PostprocessOptions): string {
  let text = normalizeSpaces(raw);
  text = removeHallucinations(text, opts.hallucinationFilters);
  text = collapseRepeats(text);
  text = applyReplacements(text, opts.replacements);
  text = normalizeSpaces(text);
  return /[\p{L}\p{N}]/u.test(text) ? text : '';
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function removeHallucinations(text: string, filters: readonly string[]): string {
  let out = text;
  for (const filter of filters) {
    const phrase = filter.trim();
    if (!phrase) continue;
    // Whole phrase, any case, with optional trailing punctuation.
    out = out.replace(new RegExp(`${escapeRegExp(phrase)}[.!?…]*`, 'giu'), ' ');
  }
  return out;
}

/** Drops a sentence repeated 3+ times in a row, keeping one copy. */
export function collapseRepeats(text: string, minRepeats = 3): string {
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/gu) ?? [];
  const out: string[] = [];
  let i = 0;
  while (i < sentences.length) {
    const current = sentences[i] ?? '';
    let j = i + 1;
    while (j < sentences.length && sameSentence(sentences[j] ?? '', current)) j++;
    const count = j - i;
    if (count >= minRepeats) out.push(current);
    else for (let k = i; k < j; k++) out.push(sentences[k] ?? '');
    i = j;
  }
  return out.join('');
}

function sameSentence(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  return norm(a) !== '' && norm(a) === norm(b);
}

export function applyReplacements(
  text: string,
  replacements: readonly { from: string; to: string }[],
): string {
  let out = text;
  for (const { from, to } of replacements) {
    if (!from.trim()) continue;
    // Word boundaries that understand accented letters.
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(from)}(?![\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, () => to);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}
