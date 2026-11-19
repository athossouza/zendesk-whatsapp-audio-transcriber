import { computeAudioKey } from '@/src/shared/audio-key';
import {
  buildNoteBody,
  NoteError,
  parseTranscriptNotes,
  ZendeskApi,
} from '@/entrypoints/content/zendesk-api';

const KEY = 'a'.repeat(32);

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function apiWith(responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch');
    return next;
  });
  return { api: new ZendeskApi(fetchImpl as unknown as typeof fetch, document), calls };
}

describe('buildNoteBody', () => {
  it('follows the spec template and ends with the marker', () => {
    const body = buildNoteBody(
      {
        author: 'Cliente Teste',
        time: '2026-11-19T17:11:52.353Z',
        durationSeconds: 6.9,
        text: 'Bom dia.',
        model: 'onnx-community/whisper-small',
        audioKey: KEY,
      },
      'pt-BR',
      'America/Sao_Paulo',
    );
    expect(body).toBe(
      [
        'Transcrição do áudio de Cliente Teste (19/11/2026, 14:11, 0:06)',
        '',
        'Bom dia.',
        '',
        '—',
        'Gerada por IA no computador do agente (whisper-small). Pode conter erros.',
        `[atveza-transcricao:${KEY}]`,
      ].join('\n'),
    );
  });

  it('round-trips through parseTranscriptNotes, ignoring public comments', () => {
    const body = buildNoteBody({
      author: null,
      time: null,
      durationSeconds: null,
      text: 'Linha 1\nLinha 2',
      model: 'm',
      audioKey: KEY,
    });
    const found = parseTranscriptNotes([
      { body, public: false },
      { body: body.replace('Linha', 'Pública'), public: true },
    ]);
    expect(found.get(KEY)).toBe('Linha 1\nLinha 2');
    expect(found.size).toBe(1);
  });
});

describe('ZendeskApi.saveInternalNote', () => {
  it('sends a private comment with the CSRF token from users/me', async () => {
    const { api, calls } = apiWith([
      json({ user: { authenticity_token: 'tok1' } }),
      json({ ticket: {} }),
    ]);
    await api.saveInternalNote(454, 'texto');
    const put = calls[1]!;
    expect(put.url).toBe('/api/v2/tickets/454.json');
    expect(put.init?.method).toBe('PUT');
    expect((put.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok1');
    expect(JSON.parse(String(put.init?.body))).toEqual({
      ticket: { comment: { body: 'texto', public: false } },
    });
  });

  it('falls back to the meta tag and retries once with a fresh token on 422', async () => {
    const meta = document.createElement('meta');
    meta.name = 'csrf-token';
    meta.content = 'meta-tok';
    document.head.appendChild(meta);
    const { api, calls } = apiWith([
      json({}, 500),
      new Response('', { status: 422 }),
      json({ user: { authenticity_token: 'fresh' } }),
      json({}),
    ]);
    await api.saveInternalNote(1, 'x');
    expect((calls[1]!.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe('meta-tok');
    expect((calls[3]!.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe('fresh');
    meta.remove();
  });

  it.each([
    [403, 'FORBIDDEN'],
    [500, 'SERVER'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const { api } = apiWith([json({ user: { authenticity_token: 't' } }), json({}, status)]);
    await expect(api.saveInternalNote(1, 'x')).rejects.toMatchObject({ kind });
  });

  it('maps a 401 that survives the retry to SESSION_EXPIRED', async () => {
    const { api } = apiWith([
      json({ user: { authenticity_token: 't' } }),
      json({}, 401),
      json({ user: { authenticity_token: 't2' } }),
      json({}, 401),
    ]);
    const err = await api.saveInternalNote(1, 'x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NoteError);
    expect((err as NoteError).kind).toBe('SESSION_EXPIRED');
  });
});

describe('ZendeskApi.listTranscriptNotes', () => {
  it('reads up to 3 pages', async () => {
    const page = (more: boolean) =>
      json({ comments: [], meta: { has_more: more }, links: { next: more ? '/next' : null } });
    const { api, calls } = apiWith([page(true), page(true), page(true), page(true)]);
    await api.listTranscriptNotes(454);
    expect(calls).toHaveLength(3);
    expect(calls[0]!.url).toContain('/api/v2/tickets/454/comments.json');
  });
});

describe('computeAudioKey', () => {
  const base = {
    subdomain: 'd3v-atveza',
    ticketId: 454,
    time: '2026-11-19T17:11:52.353Z',
    index: 0,
  };

  it('is 32 hex chars, stable, and ignores blob URLs', async () => {
    const a = await computeAudioKey(base);
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(await computeAudioKey({ ...base, url: 'blob:https://x/1' })).toBe(a);
  });

  it('changes with ticket, time or position (never duration); uses canonical https URLs', async () => {
    const a = await computeAudioKey(base);
    expect(await computeAudioKey({ ...base, ticketId: 455 })).not.toBe(a);
    expect(await computeAudioKey({ ...base, index: 1 })).not.toBe(a);
    const u1 = await computeAudioKey({ ...base, url: 'https://x/a.ogg?sig=1' });
    expect(await computeAudioKey({ ...base, time: null, url: 'https://x/a.ogg?sig=2' })).toBe(u1);
  });
});
