export function formatMb(bytes: number): string {
  return `${(bytes / 1e6).toFixed(0)} MB`;
}

export function formatSeconds(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`;
}

export function formatDuration(seconds: number): string {
  // Truncate like the Zendesk player (1:04.6 shows as 1:04).
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
}

/**
 * Splits a transcript into short paragraphs for reading (display only; the saved
 * note keeps the original text). A one-minute audio is a single wall of text
 * otherwise. Breaks only at sentence ends.
 */
export function toParagraphs(text: string, sentencesPerParagraph = 3): string[] {
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+["'”»)]*|$)\s*/gu) ?? [text];
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    const chunk = sentences
      .slice(i, i + sentencesPerParagraph)
      .join('')
      .trim();
    if (chunk) paragraphs.push(chunk);
  }
  return paragraphs.length ? paragraphs : [text];
}
