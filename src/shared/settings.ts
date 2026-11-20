import { z } from './zod';
import { DEFAULT_MODEL } from './models';

/** User settings (spec section 9). Stored in chrome.storage.sync, overridable by managed policy. */
export const SettingsSchema = z.object({
  model: z.string().default(DEFAULT_MODEL),
  language: z.enum(['portuguese', 'english', 'spanish', 'auto']).default('portuguese'),
  enabled: z.boolean().default(true),
  autoTranscribe: z.boolean().default(false),
  autoSaveNote: z.boolean().default(false),
  replacements: z.array(z.object({ from: z.string().min(1), to: z.string() })).default([]),
  hallucinationFilters: z
    .array(z.string())
    .default([
      'Legendas pela comunidade Amara.org',
      'Obrigado por assistir',
      'Inscreva-se no canal',
    ]),
  modelMirror: z.string().url().startsWith('https://').or(z.literal('')).default(''),
  selectorsUrl: z.string().url().startsWith('https://').or(z.literal('')).default(''),
  /** Empty = any Zendesk account. Companies can restrict it via Chrome policy. */
  allowedSubdomains: z
    .array(z.string())
    .default(__CLIENT__.zendeskSubdomains.includes('*') ? [] : __CLIENT__.zendeskSubdomains),
  maxAudioMinutes: z.number().int().min(1).max(30).default(10),
  discoveryMode: z.boolean().default(false),
  debug: z.boolean().default(false),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({
  replacements: __CLIENT__.replacements,
});

/**
 * Merges stored values over defaults, then managed (admin policy) values over everything.
 * Invalid stored values fall back to defaults field by field.
 */
export function resolveSettings(
  synced: Record<string, unknown>,
  managed: Record<string, unknown> = {},
): Settings {
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const source of [synced, managed]) {
    for (const [key, value] of Object.entries(source)) {
      if (!(key in SettingsSchema.shape)) continue;
      const field = SettingsSchema.shape[key as keyof Settings];
      const parsed = field.safeParse(value);
      if (parsed.success) merged[key] = parsed.data;
    }
  }
  return SettingsSchema.parse(merged);
}

export async function loadSettings(): Promise<Settings> {
  const synced = await chrome.storage.sync.get(null);
  let managed: Record<string, unknown> = {};
  try {
    managed = await chrome.storage.managed.get(null);
  } catch {
    // No managed schema/policy available: ignore.
  }
  return resolveSettings(synced, managed);
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}
