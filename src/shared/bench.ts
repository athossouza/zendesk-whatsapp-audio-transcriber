import { describeDtype } from './backend';
import type { Dtype } from './models';
import { wordErrorRate } from './wer';

/** One transcription in a Phase 1 benchmark (spec section 15, Fase 1). */
export interface BenchRun {
  model: string;
  device: 'webgpu' | 'wasm';
  dtype: Dtype;
  file: string;
  audioSeconds: number;
  reference: string | null;
  text: string;
  loadMs: number;
  coldStart: boolean;
  modelBytes: number;
  transcribeMs: number;
  firstTextMs: number | null;
  error: string | null;
}

export interface BenchSummary {
  config: string;
  model: string;
  device: 'webgpu' | 'wasm';
  dtype: string;
  runs: number;
  errors: number;
  modelMb: number;
  coldLoadMs: number | null;
  /** Seconds of processing per second of audio. < 1 is faster than real time. */
  rtf: number | null;
  /** Spec target: <= 15 000 ms for a 60 s audio. */
  msPer60s: number | null;
  /** Spec target: <= 5 000 ms. */
  avgFirstTextMs: number | null;
  /** Word-weighted WER over runs that have a reference. */
  wer: number | null;
}

export function configKey(run: Pick<BenchRun, 'model' | 'device' | 'dtype'>): string {
  return `${run.model.split('/').pop()} · ${run.device} · ${describeDtype(run.dtype)}`;
}

export function summarize(runs: readonly BenchRun[]): BenchSummary[] {
  const groups = new Map<string, BenchRun[]>();
  for (const run of runs) {
    const key = configKey(run);
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return [...groups.entries()].map(([config, group]) => {
    const ok = group.filter((r) => !r.error);
    const first = group[0] as BenchRun;
    const audioMs = ok.reduce((s, r) => s + r.audioSeconds * 1000, 0);
    const procMs = ok.reduce((s, r) => s + r.transcribeMs, 0);
    const cold = ok.filter((r) => r.coldStart).map((r) => r.loadMs);
    const firsts = ok.map((r) => r.firstTextMs).filter((v): v is number => v !== null);
    let errors = 0;
    let words = 0;
    for (const r of ok) {
      if (r.reference === null) continue;
      const w = wordErrorRate(r.reference, r.text);
      errors += w.substitutions + w.deletions + w.insertions;
      words += w.referenceWords;
    }
    return {
      config,
      model: first.model,
      device: first.device,
      dtype: describeDtype(first.dtype),
      runs: group.length,
      errors: group.length - ok.length,
      modelMb: Math.max(0, ...ok.map((r) => r.modelBytes)) / 1e6,
      coldLoadMs: cold.length ? Math.max(...cold) : null,
      rtf: audioMs ? procMs / audioMs : null,
      msPer60s: audioMs ? (procMs / audioMs) * 60_000 : null,
      avgFirstTextMs: firsts.length ? firsts.reduce((a, b) => a + b, 0) / firsts.length : null,
      wer: words ? errors / words : null,
    };
  });
}

export function toCsv(runs: readonly BenchRun[]): string {
  const header = [
    'model',
    'device',
    'dtype',
    'file',
    'audio_s',
    'load_ms',
    'cold_start',
    'model_mb',
    'transcribe_ms',
    'first_text_ms',
    'wer',
    'error',
    'text',
  ];
  const rows = runs.map((r) => [
    r.model,
    r.device,
    describeDtype(r.dtype),
    r.file,
    r.audioSeconds.toFixed(2),
    r.loadMs.toFixed(0),
    String(r.coldStart),
    (r.modelBytes / 1e6).toFixed(1),
    r.transcribeMs.toFixed(0),
    r.firstTextMs?.toFixed(0) ?? '',
    r.reference === null || r.error ? '' : wordErrorRate(r.reference, r.text).wer.toFixed(3),
    r.error ?? '',
    r.text,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
