import { isExtensionContextValid, requestTranscription } from '@/src/shared/transcribe-client';
import { z } from '@/src/shared/zod';

const req = { audioKey: 'k', ticketId: 1, subdomain: 's', base64: 'AA==' };

afterEach(() => vi.restoreAllMocks());

describe('requestTranscription', () => {
  it('reports EXTENSION_UPDATED (and notifies the UI) when the context is invalidated', async () => {
    vi.spyOn(chrome.runtime, 'connect').mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    const progress = vi.fn();
    const out = await requestTranscription(req, progress).done;
    expect(out).toMatchObject({ type: 'ERROR', code: 'EXTENSION_UPDATED' });
    expect(progress).toHaveBeenCalledWith(out);
  });

  it('notifies the UI when the service worker disconnects mid-request', async () => {
    let onDisconnect: (() => void) | undefined;
    const port = {
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: (fn: () => void) => (onDisconnect = fn) },
      postMessage: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.spyOn(chrome.runtime, 'connect').mockReturnValue(port as unknown as chrome.runtime.Port);
    const progress = vi.fn();
    const handle = requestTranscription(req, progress);
    expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'TRANSCRIBE' }));
    onDisconnect?.();
    expect(await handle.done).toMatchObject({ code: 'EXTENSION_UPDATED' });
    expect(progress).toHaveBeenCalledTimes(1);
    expect(() => handle.cancel()).not.toThrow();
  });
});

describe('isExtensionContextValid', () => {
  it('is true with a runtime id', () => {
    expect(isExtensionContextValid()).toBe(true);
  });
});

describe('zod setup', () => {
  it('runs jitless: no runtime code generation (MV3)', () => {
    expect(z.config().jitless).toBe(true);
  });
});
