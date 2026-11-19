import { DEFAULT_SELECTORS, joinSelectors, pickSelectors } from '@/src/shared/selectors';
import { DEFAULT_SETTINGS, loadSettings, resolveSettings } from '@/src/shared/settings';
import { parseSubdomain, parseTicketId } from '@/src/shared/zendesk-url';

describe('zendesk-url', () => {
  it.each([
    ['/agent/tickets/454', 454],
    ['/agent/tickets/454/events', 454],
    ['/agent/tickets/new/1', null],
    ['/agent/dashboard', null],
    ['/agent/tickets/454abc', null],
  ])('parseTicketId(%s) = %s', (path, expected) => {
    expect(parseTicketId(path)).toBe(expected);
  });

  it('parses the subdomain only for zendesk.com hosts', () => {
    expect(parseSubdomain('d3v-atveza.zendesk.com')).toBe('d3v-atveza');
    expect(parseSubdomain('zendesk.com.evil.io')).toBeNull();
    expect(parseSubdomain('a.b.zendesk.com')).toBeNull();
  });
});

describe('selectors', () => {
  it('ships a valid default config', () => {
    expect(DEFAULT_SELECTORS.version).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_SELECTORS.audioContainers).toContain("[data-test-id='audio-player-container']");
  });

  it('accepts a remote config only when valid and newer', () => {
    const newer = { ...DEFAULT_SELECTORS, version: DEFAULT_SELECTORS.version + 1 };
    expect(pickSelectors(DEFAULT_SELECTORS, newer).version).toBe(newer.version);
    expect(pickSelectors(DEFAULT_SELECTORS, { ...newer, version: 0 })).toBe(DEFAULT_SELECTORS);
    expect(pickSelectors(DEFAULT_SELECTORS, { version: 99 })).toBe(DEFAULT_SELECTORS);
    expect(pickSelectors(DEFAULT_SELECTORS, 'alert(1)')).toBe(DEFAULT_SELECTORS);
  });

  it('drops selectors the browser rejects', () => {
    expect(joinSelectors(['[[[', 'audio'])).toBe('audio');
    expect(joinSelectors(['[[['])).toBeNull();
  });
});

describe('settings', () => {
  it('uses the client defaults', () => {
    expect(DEFAULT_SETTINGS.allowedSubdomains).toEqual(['d3v-atveza', 'pdi-atveza']);
    expect(DEFAULT_SETTINGS.discoveryMode).toBe(false);
    expect(DEFAULT_SETTINGS.language).toBe('portuguese');
  });

  it('ignores invalid and unknown stored values field by field', () => {
    const s = resolveSettings({ debug: true, maxAudioMinutes: 999, language: 'klingon', foo: 1 });
    expect(s.debug).toBe(true);
    expect(s.maxAudioMinutes).toBe(10);
    expect(s.language).toBe('portuguese');
    expect(s).not.toHaveProperty('foo');
  });

  it('lets managed policy override user values', () => {
    expect(resolveSettings({ autoSaveNote: true }, { autoSaveNote: false }).autoSaveNote).toBe(
      false,
    );
  });

  it('reads from chrome.storage.sync', async () => {
    await chrome.storage.sync.set({ discoveryMode: true });
    expect((await loadSettings()).discoveryMode).toBe(true);
  });
});
