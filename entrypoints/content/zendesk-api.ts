/**
 * Zendesk REST API, called from the content script with the agent's session
 * (spec section 8). No API token, OAuth or password.
 */
import { shortModelName } from '@/src/shared/models';

export const MARKER_RE = /\[atveza-transcricao:([a-f0-9]{32})\]/;

export type NoteSaveError =
  'SESSION_EXPIRED' | 'FORBIDDEN' | 'UNPROCESSABLE' | 'RATE_LIMITED' | 'SERVER' | 'NETWORK';

export class NoteError extends Error {
  constructor(
    readonly kind: NoteSaveError,
    readonly status?: number,
  ) {
    super(kind);
    this.name = 'NoteError';
  }
}

export function noteErrorMessage(kind: NoteSaveError): string {
  switch (kind) {
    case 'SESSION_EXPIRED':
      return 'Sua sessão do Zendesk expirou. Recarregue a página.';
    case 'FORBIDDEN':
      return 'Seu perfil não permite adicionar notas neste ticket.';
    case 'UNPROCESSABLE':
      return 'Não foi possível salvar. Tickets fechados não aceitam notas.';
    case 'RATE_LIMITED':
    case 'SERVER':
    case 'NETWORK':
      return 'O Zendesk não respondeu. Tente de novo em instantes.';
  }
}

export interface NoteInput {
  author: string | null;
  time: string | null;
  durationSeconds: number | null;
  text: string;
  model: string;
  audioKey: string;
}

/** Note text (spec section 3, "Texto da nota interna"). */
export function buildNoteBody(n: NoteInput, locale = 'pt-BR', timeZone?: string): string {
  const when = n.time
    ? new Date(n.time).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short', timeZone })
    : 'data desconhecida';
  const dur =
    n.durationSeconds === null
      ? '?'
      : `${Math.floor(n.durationSeconds / 60)}:${String(Math.round(n.durationSeconds % 60)).padStart(2, '0')}`;
  return [
    `Transcrição do áudio de ${n.author ?? 'cliente'} (${when}, ${dur})`,
    '',
    n.text,
    '',
    '—',
    `Gerada por IA no computador do agente (${shortModelName(n.model)}). Pode conter erros.`,
    `[atveza-transcricao:${n.audioKey}]`,
  ].join('\n');
}

/** Extracts `{ audioKey: text }` from notes previously saved by the extension. */
export function parseTranscriptNotes(
  comments: { body?: string; plain_body?: string; public?: boolean }[],
): Map<string, string> {
  const found = new Map<string, string>();
  for (const c of comments) {
    if (c.public) continue;
    const body = c.plain_body ?? c.body ?? '';
    const marker = MARKER_RE.exec(body);
    if (!marker?.[1]) continue;
    const lines = body.split('\n');
    const start = lines.findIndex((l) => l.startsWith('Transcrição do áudio'));
    const end = lines.findIndex((l) => l.trim() === '—');
    const text = lines
      .slice(start + 1, end > start ? end : undefined)
      .join('\n')
      .trim();
    if (!found.has(marker[1])) found.set(marker[1], text);
  }
  return found;
}

export class ZendeskApi {
  private csrf: string | null = null;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch.bind(globalThis),
    private readonly doc: Document = document,
  ) {}

  /** Notes with the extension marker in this ticket (max 3 pages, spec section 8). */
  async listTranscriptNotes(ticketId: number): Promise<Map<string, string>> {
    const all: { body?: string; plain_body?: string; public?: boolean }[] = [];
    let url: string | null =
      `/api/v2/tickets/${ticketId}/comments.json?sort_order=desc&page[size]=100`;
    for (let page = 0; url && page < 3; page++) {
      const res = await this.fetchImpl(url, { credentials: 'same-origin' });
      if (!res.ok) break;
      const json = (await res.json()) as {
        comments?: typeof all;
        meta?: { has_more?: boolean };
        links?: { next?: string | null };
      };
      all.push(...(json.comments ?? []));
      url = json.meta?.has_more && json.links?.next ? json.links.next : null;
    }
    return parseTranscriptNotes(all);
  }

  /** Saves a private note. Never public: checked right before sending (spec section 8). */
  async saveInternalNote(ticketId: number, body: string): Promise<void> {
    const payload = { ticket: { comment: { body, public: false as const } } };
    if (payload.ticket.comment.public !== false)
      throw new Error('Refusing to send a public comment');

    let res = await this.put(ticketId, payload, await this.token());
    if (res.status === 401 || res.status === 422) {
      // Token may be stale: fetch a fresh one and retry once.
      this.csrf = null;
      res = await this.put(ticketId, payload, await this.token());
    }
    if (res.status === 429) {
      const wait = Math.min(30, Number(res.headers.get('Retry-After') ?? 5)) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      res = await this.put(ticketId, payload, await this.token());
    }
    if (res.ok) return;
    if (res.status === 401) throw new NoteError('SESSION_EXPIRED', 401);
    if (res.status === 403) throw new NoteError('FORBIDDEN', 403);
    if (res.status === 422) throw new NoteError('UNPROCESSABLE', 422);
    if (res.status === 429) throw new NoteError('RATE_LIMITED', 429);
    throw new NoteError('SERVER', res.status);
  }

  private async put(ticketId: number, payload: unknown, token: string | null): Promise<Response> {
    try {
      return await this.fetchImpl(`/api/v2/tickets/${ticketId}.json`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-CSRF-Token': token } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new NoteError('NETWORK');
    }
  }

  /** CSRF token: users/me first, page meta tag as fallback (spec section 8). */
  private async token(): Promise<string | null> {
    if (this.csrf) return this.csrf;
    try {
      const res = await this.fetchImpl('/api/v2/users/me.json', { credentials: 'same-origin' });
      if (res.ok) {
        const json = (await res.json()) as { user?: { authenticity_token?: string } };
        this.csrf = json.user?.authenticity_token ?? null;
      }
    } catch {
      // fall through to meta tag
    }
    this.csrf ??=
      this.doc.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
    return this.csrf;
  }
}
