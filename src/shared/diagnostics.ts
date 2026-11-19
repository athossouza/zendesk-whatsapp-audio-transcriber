import { detectGpu } from './backend';
import { readErrorLog } from './error-log';
import { DEFAULT_SELECTORS } from './selectors';
import { loadSettings } from './settings';

/**
 * "Copiar diagnóstico" (spec section 9): version, browser, GPU, model, backend
 * and last errors. No transcript text, no customer data.
 */
export async function buildDiagnostics(): Promise<Record<string, unknown>> {
  const [settings, gpu, errors, storage, managed, local] = await Promise.all([
    loadSettings(),
    detectGpu(),
    readErrorLog(),
    // navigator.storage may be missing or blocked (managed browsers, tests).
    Promise.resolve(navigator.storage?.estimate?.()).catch(() => undefined),
    managedKeys(),
    chrome.storage.local.get(null),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    client: __CLIENT__.name,
    userAgent: navigator.userAgent,
    gpu,
    crossOriginIsolated: self.crossOriginIsolated,
    settings: {
      model: settings.model,
      language: settings.language,
      enabled: settings.enabled,
      autoSaveNote: settings.autoSaveNote,
      allowedSubdomains: settings.allowedSubdomains,
      maxAudioMinutes: settings.maxAudioMinutes,
      replacements: settings.replacements.length,
      hallucinationFilters: settings.hallucinationFilters.length,
      modelMirror: settings.modelMirror ? 'custom' : 'huggingface.co',
      discoveryMode: settings.discoveryMode,
      debug: settings.debug,
    },
    managedByPolicy: managed,
    selectorsVersion: DEFAULT_SELECTORS.version,
    cachedTranscripts: Object.keys(local).filter((k) => k.startsWith('tx:')).length,
    storageUsedMb: storage?.usage ? Math.round(storage.usage / 1e6) : null,
    lastErrors: errors,
  };
}

/** Settings fixed by the company's Chrome policy (chrome.storage.managed). */
export async function managedKeys(): Promise<string[]> {
  try {
    return Object.keys(await chrome.storage.managed.get(null));
  } catch {
    return [];
  }
}
