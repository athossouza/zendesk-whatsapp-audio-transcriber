/**
 * Word error rate for Phase 1 model comparison: (substitutions + deletions + insertions) / reference words.
 * Text is normalized first: lowercase, no punctuation, no accents, numbers kept.
 */
export interface WerResult {
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceWords: number;
}

export function normalizeForWer(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function wordErrorRate(reference: string, hypothesis: string): WerResult {
  const ref = normalizeForWer(reference);
  const hyp = normalizeForWer(hypothesis);
  const n = ref.length;
  const m = hyp.length;

  // dp[i][j] = [cost, subs, dels, ins] aligning ref[0..i) with hyp[0..j)
  type Cell = [number, number, number, number];
  let prev: Cell[] = Array.from({ length: m + 1 }, (_, j) => [j, 0, 0, j]);
  for (let i = 1; i <= n; i++) {
    const cur: Cell[] = [[i, 0, i, 0]];
    for (let j = 1; j <= m; j++) {
      const diag = prev[j - 1] as Cell;
      const up = prev[j] as Cell;
      const left = cur[j - 1] as Cell;
      const same = ref[i - 1] === hyp[j - 1];
      const options: Cell[] = [
        [diag[0] + (same ? 0 : 1), diag[1] + (same ? 0 : 1), diag[2], diag[3]],
        [up[0] + 1, up[1], up[2] + 1, up[3]],
        [left[0] + 1, left[1], left[2], left[3] + 1],
      ];
      cur.push(options.reduce((best, o) => (o[0] < best[0] ? o : best)));
    }
    prev = cur;
  }
  const [cost, substitutions, deletions, insertions] = prev[m] as Cell;
  return {
    wer: n === 0 ? (m === 0 ? 0 : 1) : cost / n,
    substitutions,
    deletions,
    insertions,
    referenceWords: n,
  };
}
