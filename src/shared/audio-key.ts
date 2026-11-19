/**
 * Stable ID of an audio (spec section 6). WhatsApp audios use `blob:` URLs that
 * change on every load (Phase 0), so the key uses the message instead:
 * subdomain + ticket + message timestamp + duration + position in the message.
 */
export interface AudioKeyInput {
  subdomain: string;
  ticketId: number;
  /** ISO timestamp of the message, or null. */
  time: string | null;
  durationSeconds: number | null;
  /** Position of this audio among the audios of the same message. */
  index: number;
  /** Stable https URL (e-mail attachments), used instead of time/duration when present. */
  url?: string | null;
}

export async function computeAudioKey(input: AudioKeyInput): Promise<string> {
  const stable = input.url && !input.url.startsWith('blob:') ? canonicalUrl(input.url) : null;
  const parts = stable
    ? [input.subdomain, input.ticketId, stable]
    : [
        input.subdomain,
        input.ticketId,
        input.time ?? 'no-time',
        input.durationSeconds === null ? 'no-duration' : input.durationSeconds.toFixed(1),
        input.index,
      ];
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join(':')));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/** URL without query string (signatures and expiry change between loads). */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}
