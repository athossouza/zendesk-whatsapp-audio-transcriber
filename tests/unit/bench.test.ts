import { summarize, toCsv, type BenchRun } from '@/src/shared/bench';
import { formatDuration, formatPercent, formatSeconds, toParagraphs } from '@/src/shared/format';

const base: BenchRun = {
  model: 'onnx-community/whisper-base',
  device: 'wasm',
  dtype: 'q8',
  file: 'a.ogg',
  audioSeconds: 10,
  reference: 'bom dia preciso de ajuda',
  text: 'bom dia preciso de ajuda',
  loadMs: 4000,
  coldStart: true,
  modelBytes: 77e6,
  transcribeMs: 2000,
  firstTextMs: 500,
  error: null,
};

describe('summarize', () => {
  it('groups by model/device/dtype and computes the spec metrics', () => {
    const runs: BenchRun[] = [
      base,
      {
        ...base,
        file: 'b.ogg',
        coldStart: false,
        loadMs: 0,
        text: 'bom dia preciso ajuda',
        firstTextMs: 700,
      },
      { ...base, device: 'webgpu', dtype: 'fp16', transcribeMs: 500 },
    ];
    const [wasm, gpu] = summarize(runs);
    expect(wasm).toMatchObject({
      config: 'whisper-base · wasm · q8',
      runs: 2,
      errors: 0,
      coldLoadMs: 4000,
    });
    expect(wasm!.rtf).toBeCloseTo(0.2);
    expect(wasm!.msPer60s).toBeCloseTo(12_000);
    expect(wasm!.avgFirstTextMs).toBe(600);
    expect(wasm!.wer).toBeCloseTo(1 / 10); // one deletion over 10 reference words
    expect(gpu!.config).toBe('whisper-base · webgpu · fp16');
  });

  it('excludes failed runs from timings and counts them', () => {
    const [s] = summarize([base, { ...base, error: 'GPU_LOST', transcribeMs: 99_999 }]);
    expect(s).toMatchObject({ runs: 2, errors: 1 });
    expect(s!.msPer60s).toBeCloseTo(12_000);
  });

  it('exports CSV with quoting', () => {
    const csv = toCsv([{ ...base, text: 'olá, "mundo"' }]);
    expect(csv.split('\n')[1]).toContain('"olá, ""mundo"""');
  });
});

describe('format', () => {
  it('formats durations and percents', () => {
    expect(formatDuration(6.9)).toBe('0:06');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(59.6)).toBe('0:59');
    expect(formatSeconds(1234)).toBe('1.2 s');
    expect(formatSeconds(null)).toBe('—');
    expect(formatPercent(0.123)).toBe('12.3%');
  });
});

describe('toParagraphs', () => {
  it('groups up to 3 sentences per paragraph', () => {
    const text = 'Um. Dois? Três! Quatro. Cinco… Seis. Sete';
    expect(toParagraphs(text)).toEqual(['Um. Dois? Três!', 'Quatro. Cinco… Seis.', 'Sete']);
  });

  it('keeps short or unpunctuated text as one paragraph', () => {
    expect(toParagraphs('Pode me mandar o boleto de novo, por favor?')).toEqual([
      'Pode me mandar o boleto de novo, por favor?',
    ]);
    expect(toParagraphs('sem pontuação nenhuma')).toEqual(['sem pontuação nenhuma']);
  });
});
