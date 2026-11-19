const TICKET_PATH = /^\/agent\/tickets\/(\d+)(?:\/|$)/;
const ZENDESK_HOST = /^([a-z0-9][a-z0-9-]*)\.zendesk\.com$/;

/** Ticket ID from an Agent Workspace path, e.g. `/agent/tickets/454` → 454. */
export function parseTicketId(pathname: string): number | null {
  const match = TICKET_PATH.exec(pathname);
  return match ? Number(match[1]) : null;
}

/** Zendesk subdomain from a hostname, e.g. `d3v-atveza.zendesk.com` → `d3v-atveza`. */
export function parseSubdomain(hostname: string): string | null {
  return ZENDESK_HOST.exec(hostname)?.[1] ?? null;
}
