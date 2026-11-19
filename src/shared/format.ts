export function formatMb(bytes: number): string {
  return `${(bytes / 1e6).toFixed(0)} MB`;
}

export function formatSeconds(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`;
}

export function formatDuration(seconds: number): string {
  // Truncate like the Zendesk player (1:04.6 shows as 1:04).
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
}
