import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectAudios, findConversationRoot, isAudioLink } from '@/entrypoints/content/detector';
import { DEFAULT_SELECTORS, type Selectors } from '@/src/shared/selectors';

const fixture = readFileSync(resolve(__dirname, '../fixtures/zendesk-ticket.html'), 'utf8');

function load(html: string): void {
  document.body.innerHTML = html; // eslint-disable-line no-restricted-properties -- test fixture
}

describe('detectAudios on the real Agent Workspace structure', () => {
  beforeEach(() => load(fixture));

  it('finds both WhatsApp audios exactly once', () => {
    const root = findConversationRoot(document, DEFAULT_SELECTORS);
    expect(root?.getAttribute('data-test-id')).toBe('omni-log-container');
    const found = detectAudios(root!, DEFAULT_SELECTORS);
    expect(found).toHaveLength(2);
    expect(found.map((c) => c.strategy)).toEqual(['audio-element', 'audio-element']);
  });

  it('resolves player, download anchor, author, time and blob src', () => {
    const [first] = detectAudios(document.body, DEFAULT_SELECTORS);
    expect(first!.player.getAttribute('data-test-id')).toBe('audio-player-container');
    expect(first!.anchor?.getAttribute('data-test-id')).toBe('audio-player-download');
    expect(first!.author).toBe('Cliente Teste');
    expect(first!.time).toBe('2026-11-19T17:11:52.353Z');
    expect(first!.src).toMatch(/^blob:https:\/\/d3v-atveza\.zendesk\.com\//);
    expect(first!.bubble?.tagName).toBe('ARTICLE');
  });

  it('still finds the player when the <audio> element is not mounted', () => {
    document.querySelectorAll('audio').forEach((a) => a.remove());
    const found = detectAudios(document.body, DEFAULT_SELECTORS);
    expect(found).toHaveLength(2);
    expect(found.every((c) => c.strategy === 'audio-container')).toBe(true);
    expect(found[0]!.src).toBeNull();
  });

  it('falls back to the text label when container selectors are outdated', () => {
    document.querySelectorAll('audio').forEach((a) => a.remove());
    const outdated: Selectors = {
      ...DEFAULT_SELECTORS,
      audioContainers: ["[data-test-id='gone']"],
    };
    const found = detectAudios(document.body, outdated);
    expect(found).toHaveLength(2);
    expect(found.every((c) => c.strategy === 'text-label')).toBe(true);
  });

  it('ignores invalid selectors instead of throwing', () => {
    const broken: Selectors = {
      ...DEFAULT_SELECTORS,
      audioContainers: ['[[[', ...DEFAULT_SELECTORS.audioContainers],
    };
    expect(() => detectAudios(document.body, broken)).not.toThrow();
  });
});

describe('detectAudios on links (e-mail attachments)', () => {
  it('detects audio links by extension and by MIME type', () => {
    load(`
      <article>
        <a href="https://x.zendesk.com/attachments/token/abc/?name=audio.ogg" download="audio.ogg">audio.ogg</a>
        <a href="/files/voice" type="audio/mpeg">voz</a>
        <a href="/files/report.pdf">report.pdf</a>
      </article>`);
    const found = detectAudios(document.body, DEFAULT_SELECTORS);
    expect(found.map((c) => c.strategy)).toEqual(['audio-link', 'audio-link']);
  });

  it('isAudioLink checks the path, not the query string', () => {
    load('<a href="/download?file=a.mp3">x</a>');
    expect(isAudioLink(document.querySelector('a')!, ['mp3'])).toBe(false);
  });
});
