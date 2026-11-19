import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectAudios, findConversationRoot } from '@/entrypoints/content/detector';
import {
  buildEntry,
  describeSrc,
  maskHtml,
  mergeEntries,
  pathPattern,
  probeFetch,
  type DiscoveryEntry,
} from '@/src/shared/discovery';
import { appendDiscoveryEntries, readDiscoveryReport } from '@/src/shared/discovery-store';
import { DEFAULT_SELECTORS } from '@/src/shared/selectors';

const fixture = readFileSync(resolve(__dirname, '../fixtures/zendesk-ticket.html'), 'utf8');

beforeEach(() => {
  document.body.innerHTML = fixture; // eslint-disable-line no-restricted-properties -- test fixture
});

function entries(): DiscoveryEntry[] {
  const root = findConversationRoot(document, DEFAULT_SELECTORS);
  return detectAudios(root!, DEFAULT_SELECTORS).map((c, index) =>
    buildEntry(c, root, {
      subdomain: 'd3v-atveza',
      ticketId: 454,
      index,
      safeLabels: DEFAULT_SELECTORS.textLabels,
    }),
  );
}

describe('discovery report', () => {
  it('never contains customer names or message texts', () => {
    const json = JSON.stringify(entries());
    expect(json).not.toContain('Cliente Teste');
    expect(json).not.toContain('Agente Teste');
    expect(json).not.toContain('licença');
    expect(json).not.toContain('7ad87716'); // blob id
  });

  it('keeps structure: test ids, chain up to the conversation root, player labels', () => {
    const [first] = entries();
    expect(first!.chain[0]!.testId).toBe('audio-player-container');
    expect(first!.chain.at(-1)!.testId).toBe('omni-log-container');
    expect(first!.maskedHtml).toContain('data-test-id="audio-player-download"');
    expect(first!.maskedHtml).toContain('Gravação de WhatsApp');
    expect(first!.maskedHtml).toContain('0:00 / 0:06');
    expect(first!.src).toEqual({
      scheme: 'blob',
      host: 'd3v-atveza.zendesk.com',
      pathPattern: '/:uuid',
    });
    expect(first!).toMatchObject({ hasAnchor: true, hasAuthor: true, hasTime: true });
  });

  it('reduces URLs to host and path pattern', () => {
    expect(
      describeSrc(
        'https://d3v-atveza.zendesk.com/api/v2/ticket_attachments/01M7TPZNC5H2ARFWXQYE0ZHPH2/content?token=x',
      ),
    ).toEqual({
      scheme: 'https',
      host: 'd3v-atveza.zendesk.com',
      pathPattern: '/api/v2/ticket_attachments/:id/content',
    });
    expect(pathPattern('/agent/tickets/454')).toBe('/agent/tickets/454');
    expect(describeSrc(null)).toBeNull();
  });

  it('masks text and sensitive attributes', () => {
    const el = document.createElement('div');
    el.setAttribute('aria-label', 'Mensagem de Fulano');
    el.setAttribute('class', 'sc-abc');
    el.textContent = 'Fulano';
    const html = maskHtml(el, []);
    expect(html).toBe('<div aria-label="******** ** ******">******</div>');
  });

  it('merges entries by key and caps the size', () => {
    const [a, b] = entries();
    const merged = mergeEntries([a!], [{ ...a!, seenAt: '2099-01-01T00:00:00Z' }, b!], 10);
    expect(merged).toHaveLength(2);
    expect(merged[0]!.seenAt).toBe('2099-01-01T00:00:00Z');
    expect(mergeEntries([], [a!, b!], 1)).toHaveLength(1);
  });

  it('persists entries in chrome.storage.local', async () => {
    await appendDiscoveryEntries(entries());
    const report = await readDiscoveryReport();
    expect(report.entries).toHaveLength(2);
  });
});

describe('probeFetch', () => {
  it('reports size and mime without keeping bytes', async () => {
    const fake = vi.fn().mockResolvedValue(
      new Response(new Uint8Array(17217), {
        status: 200,
        headers: { 'content-type': 'audio/ogg' },
      }),
    );
    expect(await probeFetch('blob:x', fake)).toEqual({
      ok: true,
      status: 200,
      mime: 'audio/ogg',
      bytes: 17217,
    });
  });

  it('reports network errors', async () => {
    const fake = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await probeFetch('blob:x', fake)).toEqual({ ok: false, error: 'TypeError' });
  });
});
