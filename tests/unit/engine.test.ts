import { chooseEngine, describeDtype } from '@/src/shared/backend';
import { base64ToBytes, bytesToBase64 } from '@/src/shared/base64';
import { classifyError, errorMessage, TranscriberError } from '@/src/shared/errors';
import { ProgressSchema, ToBackgroundSchema, ToOffscreenSchema } from '@/src/shared/messages';
import { applyReplacements, collapseRepeats, postprocess } from '@/src/shared/postprocess';
import { wordErrorRate } from '@/src/shared/wer';

const SMALL = 'onnx-community/whisper-small';
const BASE = 'onnx-community/whisper-base';

describe('chooseEngine (spec section 7)', () => {
  it('uses WebGPU with fp16 encoder + q4 decoder when shader-f16 exists', () => {
    expect(chooseEngine({ model: SMALL }, { webgpu: true, shaderF16: true })).toEqual({
      model: SMALL,
      device: 'webgpu',
      dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
      downgraded: false,
    });
  });

  it('uses the non-f16 preset dtype on WebGPU without shader-f16', () => {
    expect(chooseEngine({ model: SMALL }, { webgpu: true, shaderF16: false }).dtype).toBe('fp32');
  });

  it('falls back to whisper-base on WASM when there is no WebGPU', () => {
    expect(chooseEngine({ model: SMALL }, { webgpu: false, shaderF16: false })).toEqual({
      model: BASE,
      device: 'wasm',
      dtype: 'q8',
      downgraded: true,
    });
  });

  it('keeps the requested model when WASM is forced (benchmarks) and honors dtype overrides', () => {
    const c = chooseEngine(
      { model: SMALL, device: 'wasm', dtype: 'q4' },
      { webgpu: true, shaderF16: true },
    );
    expect(c).toMatchObject({ model: SMALL, device: 'wasm', dtype: 'q4', downgraded: false });
  });

  it('describes dtypes', () => {
    expect(describeDtype('q8')).toBe('q8');
    expect(describeDtype({ encoder_model: 'fp16', decoder_model_merged: 'q4' })).toBe(
      'enc:fp16/dec:q4',
    );
  });
});

describe('postprocess (spec section 7)', () => {
  const opts = {
    hallucinationFilters: ['Legendas pela comunidade Amara.org', 'Obrigado por assistir'],
    replacements: [
      { from: 'edge cam', to: 'EDGECAM' },
      { from: 'solid works', to: 'SOLIDWORKS' },
    ],
  };

  it('removes silence hallucinations and returns empty when nothing is left', () => {
    expect(postprocess(' Legendas pela comunidade Amara.org ', opts)).toBe('');
    expect(postprocess('obrigado por assistir!', opts)).toBe('');
    expect(postprocess('...', opts)).toBe('');
  });

  it('keeps real speech around a hallucination', () => {
    expect(postprocess('Bom dia, preciso de ajuda. Obrigado por assistir.', opts)).toBe(
      'Bom dia, preciso de ajuda.',
    );
  });

  it('collapses a sentence repeated 3+ times, but not 2', () => {
    expect(collapseRepeats('Oi. Tudo bem? Tudo bem? Tudo bem? Certo.')).toBe(
      'Oi. Tudo bem? Certo.',
    );
    expect(collapseRepeats('Sim. Sim. Ok.')).toBe('Sim. Sim. Ok.');
  });

  it('applies the client dictionary case-insensitively, on word boundaries', () => {
    expect(applyReplacements('O Edge Cam e o solid  works', opts.replacements)).toBe(
      'O EDGECAM e o SOLIDWORKS',
    );
    expect(applyReplacements('pledge camera', opts.replacements)).toBe('pledge camera');
  });
});

describe('wordErrorRate', () => {
  it('is 0 for identical text, ignoring case, accents and punctuation', () => {
    expect(wordErrorRate('Olá, licença do EDGECAM!', 'ola licenca do edgecam').wer).toBe(0);
  });

  it('counts substitutions, deletions and insertions', () => {
    const r = wordErrorRate('a b c d', 'a x c d e');
    expect(r).toMatchObject({ substitutions: 1, deletions: 0, insertions: 1, referenceWords: 4 });
    expect(r.wer).toBe(0.5);
    expect(wordErrorRate('a b c', 'a').deletions).toBe(2);
  });

  it('handles empty references', () => {
    expect(wordErrorRate('', '').wer).toBe(0);
    expect(wordErrorRate('', 'ruído').wer).toBe(1);
  });
});

describe('errors', () => {
  it('maps raw errors to codes', () => {
    expect(classifyError(new TranscriberError('NO_SPEECH'))).toBe('NO_SPEECH');
    expect(classifyError(new DOMException('x', 'QuotaExceededError'))).toBe('STORAGE_QUOTA');
    expect(classifyError(new Error('GPU device was lost'))).toBe('GPU_LOST');
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('MODEL_DOWNLOAD_FAILED');
    expect(classifyError('boom')).toBe('TRANSCRIBE_FAILED');
  });

  it('has Portuguese messages', () => {
    expect(errorMessage('AUDIO_TOO_LONG', { maxMinutes: 5 })).toContain('máx. 5 min');
    expect(errorMessage('CANCELLED')).toBeNull();
  });
});

describe('message schemas', () => {
  it('accepts valid messages and rejects unknown or malformed ones', () => {
    expect(
      ToBackgroundSchema.safeParse({
        type: 'TRANSCRIBE',
        requestId: 'r1',
        audioKey: 'k',
        ticketId: 454,
        subdomain: 'd3v-atveza',
        base64: 'AAAA',
      }).success,
    ).toBe(true);
    expect(ToBackgroundSchema.safeParse({ type: 'EVAL', code: 'x' }).success).toBe(false);
    expect(ToBackgroundSchema.safeParse({ type: 'CANCEL' }).success).toBe(false);
    expect(ToOffscreenSchema.safeParse({ type: 'OFF_CANCEL', requestId: 'r1' }).success).toBe(true);
    expect(ProgressSchema.safeParse({ type: 'PARTIAL', requestId: 'r1', text: 'oi' }).success).toBe(
      true,
    );
  });
});

describe('base64', () => {
  it('round-trips binary data larger than one chunk', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});
