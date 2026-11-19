import { buildDiagnostics } from '@/src/shared/diagnostics';
import { logError, readErrorLog } from '@/src/shared/error-log';

describe('error log', () => {
  it('keeps the last 20 errors, newest first, and ignores CANCELLED', async () => {
    for (let i = 0; i < 25; i++) await logError('TRANSCRIBE_FAILED', `e${i}`);
    await logError('CANCELLED');
    const log = await readErrorLog();
    expect(log).toHaveLength(20);
    expect(log[0]).toMatchObject({ code: 'TRANSCRIBE_FAILED', detail: 'e24' });
  });
});

describe('buildDiagnostics', () => {
  it('reports environment and settings without transcript text', async () => {
    await chrome.storage.local.set({
      'tx:abc': { text: 'segredo do cliente', createdAt: new Date().toISOString() },
    });
    await chrome.storage.sync.set({ replacements: [{ from: 'edge cam', to: 'EDGECAM' }] });
    const diag = await buildDiagnostics();
    expect(diag).toMatchObject({ client: 'dev', cachedTranscripts: 1 });
    const json = JSON.stringify(diag);
    expect(json).not.toContain('segredo do cliente');
    expect(json).not.toContain('edge cam');
    expect((diag.settings as { replacements: number }).replacements).toBe(1);
  });
});
