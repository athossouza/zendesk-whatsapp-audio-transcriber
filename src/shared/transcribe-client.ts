import { ProgressSchema, TRANSCRIBE_PORT, type Progress, type TranscribeRequest } from './messages';

type Final = Extract<Progress, { type: 'DONE' | 'ERROR' }>;

export interface TranscribeHandle {
  done: Promise<Final>;
  cancel: () => void;
}

/**
 * False in tabs opened before the extension was reloaded or updated: their
 * content script is orphaned and every chrome.* call throws
 * "Extension context invalidated" (spec section 12, EXTENSION_UPDATED).
 */
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * Client side of the transcription protocol, for content scripts and extension pages.
 * One port per request; closing it cancels the request in the service worker.
 * Never throws: failures arrive as an ERROR progress message, so the UI always leaves
 * its busy state.
 */
export function requestTranscription(
  req: Omit<TranscribeRequest, 'type' | 'requestId'>,
  onProgress: (p: Progress) => void,
): TranscribeHandle {
  const requestId = crypto.randomUUID();
  const updated: Final = { type: 'ERROR', requestId, code: 'EXTENSION_UPDATED' };

  let port: chrome.runtime.Port;
  try {
    if (!isExtensionContextValid()) throw new Error('context invalidated');
    port = chrome.runtime.connect({ name: TRANSCRIBE_PORT });
  } catch {
    onProgress(updated);
    return { done: Promise.resolve(updated), cancel: () => undefined };
  }

  let settled = false;
  const done = new Promise<Final>((resolve) => {
    const finish = (msg: Final) => {
      if (settled) return;
      settled = true;
      onProgress(msg);
      resolve(msg);
    };
    port.onMessage.addListener((raw: unknown) => {
      const parsed = ProgressSchema.safeParse(raw);
      if (!parsed.success || parsed.data.requestId !== requestId) return;
      const msg = parsed.data;
      if (msg.type === 'DONE' || msg.type === 'ERROR') {
        finish(msg);
        port.disconnect();
      } else {
        onProgress(msg);
      }
    });
    // Service worker gone mid-request (extension reloaded or crashed).
    port.onDisconnect.addListener(() => finish(updated));
    try {
      port.postMessage({ ...req, type: 'TRANSCRIBE', requestId });
    } catch {
      finish(updated);
    }
  });

  return {
    done,
    cancel: () => {
      if (settled) return;
      try {
        port.postMessage({ type: 'CANCEL', requestId });
      } catch {
        // Port already closed: nothing to cancel.
      }
    },
  };
}
