import type { DiscoveryEntry, DiscoveryReport } from './discovery';
import { mergeEntries } from './discovery';

const KEY = 'discoveryEntries';

export async function appendDiscoveryEntries(entries: DiscoveryEntry[]): Promise<void> {
  if (!entries.length) return;
  const stored = await chrome.storage.local.get(KEY);
  const existing = (stored[KEY] as DiscoveryEntry[] | undefined) ?? [];
  await chrome.storage.local.set({ [KEY]: mergeEntries(existing, entries) });
}

export async function readDiscoveryReport(): Promise<DiscoveryReport> {
  const stored = await chrome.storage.local.get(KEY);
  return {
    generatedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    userAgent: navigator.userAgent,
    entries: (stored[KEY] as DiscoveryEntry[] | undefined) ?? [],
  };
}

export async function clearDiscoveryEntries(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}
