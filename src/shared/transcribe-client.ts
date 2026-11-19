import { ProgressSchema, TRANSCRIBE_PORT, type Progress, type TranscribeRequest } from './messages';

export interface TranscribeHandle {
  done: Promise<Extract<Progress, { type: 'DONE' | 'ERROR' }>>;
  cancel: () => void;
}

/**
 * Client side of the transcription protocol, for content scripts and extension pages.
 * One port per request; closing it cancels the request in the service worker.
 */
export function requestTranscription(
  req: Omit<TranscribeRequest, 'type' | 'requestId'>,
  onProgress: (p: Progress) => void,
): TranscribeHandle {
  const requestId = crypto.randomUUID();
  const port = chrome.runtime.connect({ name: TRANSCRIBE_PORT });
  let settled = false;

  const done = new Promise<Extract<Progress, { type: 'DONE' | 'ERROR' }>>((resolve) => {
    port.onMessage.addListener((raw: unknown) => {
      const parsed = ProgressSchema.safeParse(raw);
      if (!parsed.success || parsed.data.requestId !== requestId) return;
      const msg = parsed.data;
      onProgress(msg);
      if (msg.type === 'DONE' || msg.type === 'ERROR') {
        settled = true;
        resolve(msg);
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => {
      if (!settled) resolve({ type: 'ERROR', requestId, code: 'EXTENSION_UPDATED' });
    });
  });

  port.postMessage({ ...req, type: 'TRANSCRIBE', requestId });

  return {
    done,
    cancel: () => {
      if (!settled) port.postMessage({ type: 'CANCEL', requestId });
    },
  };
}
