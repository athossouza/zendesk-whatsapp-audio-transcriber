import type { ErrorCode } from './errors';

/** Last errors for "Copiar diagnóstico" (spec section 9). Codes only, never transcript text. */
const KEY = 'errorLog';
const MAX = 20;

export interface ErrorLogEntry {
  at: string;
  code: ErrorCode;
  /** Technical detail, truncated; never contains transcript text. */
  detail?: string;
}

export async function logError(code: ErrorCode, detail?: string): Promise<void> {
  if (code === 'CANCELLED') return;
  const stored = (await chrome.storage.local.get(KEY))[KEY] as ErrorLogEntry[] | undefined;
  const entry: ErrorLogEntry = { at: new Date().toISOString(), code };
  if (detail) entry.detail = detail.slice(0, 200);
  await chrome.storage.local.set({ [KEY]: [entry, ...(stored ?? [])].slice(0, MAX) });
}

export async function readErrorLog(): Promise<ErrorLogEntry[]> {
  return ((await chrome.storage.local.get(KEY))[KEY] as ErrorLogEntry[] | undefined) ?? [];
}
