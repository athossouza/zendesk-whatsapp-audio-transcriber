import { TranscriptResultSchema, type TranscriptResult } from './messages';

/** Local transcript cache (spec section 9): `tx:{audioKey}`, 30 days, max 500 items. */
const PREFIX = 'tx:';
const MAX_ITEMS = 500;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function saveTranscript(result: TranscriptResult): Promise<void> {
  // Metrics are only for benchmarks; raw text is not kept.
  const { metrics, ...stored } = result;
  await chrome.storage.local.set({ [PREFIX + result.audioKey]: stored });
  await pruneTranscripts();
}

export async function getTranscripts(
  audioKeys: string[],
): Promise<Record<string, TranscriptResult>> {
  const raw = await chrome.storage.local.get(audioKeys.map((k) => PREFIX + k));
  const out: Record<string, TranscriptResult> = {};
  for (const [key, value] of Object.entries(raw)) {
    const parsed = TranscriptResultSchema.safeParse(value);
    if (parsed.success && !isExpired(parsed.data)) out[key.slice(PREFIX.length)] = parsed.data;
  }
  return out;
}

export async function pruneTranscripts(now = Date.now()): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const items = Object.entries(all)
    .filter(([k]) => k.startsWith(PREFIX))
    .map(([k, v]) => ({
      key: k,
      createdAt: Date.parse((v as { createdAt?: string }).createdAt ?? '') || 0,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
  const remove = items.filter((item, i) => i >= MAX_ITEMS || now - item.createdAt > MAX_AGE_MS);
  if (remove.length) await chrome.storage.local.remove(remove.map((r) => r.key));
}

export async function clearTranscripts(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith(PREFIX)));
}

function isExpired(t: TranscriptResult, now = Date.now()): boolean {
  return now - Date.parse(t.createdAt) > MAX_AGE_MS;
}
