import { z } from './zod';

/** Per-module ONNX precision, as accepted by Transformers.js `dtype`. */
export const DtypeSchema = z.union([
  z.string().min(1).max(20),
  z.object({ encoder_model: z.string().max(20), decoder_model_merged: z.string().max(20) }),
]);
export type Dtype = z.infer<typeof DtypeSchema>;

export type Device = 'webgpu' | 'wasm';

export interface ModelPreset {
  id: string;
  label: string;
  /** WebGPU with `shader-f16`. */
  webgpuF16: Dtype;
  /** WebGPU without `shader-f16`. */
  webgpu: Dtype;
  wasm: Dtype;
  /** Approximate download (MB) for the WebGPU f16 dtype, from the Hub file list (2026-11-19). */
  approxMb: number;
}

/**
 * Candidate models (spec section 7). IDs and file sizes checked on the Hub on 2026-11-19.
 * The defaults here are starting points; Phase 1 benchmarks pick the final ones.
 */
export const MODEL_PRESETS: readonly ModelPreset[] = [
  {
    id: 'onnx-community/whisper-base',
    label: 'Whisper base (leve)',
    webgpuF16: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
    webgpu: 'fp32',
    wasm: 'q8',
    approxMb: 165,
  },
  {
    id: 'onnx-community/whisper-small',
    label: 'Whisper small (equilibrado)',
    webgpuF16: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
    webgpu: 'fp32',
    wasm: 'q8',
    approxMb: 410,
  },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    label: 'Whisper large-v3-turbo (alta qualidade)',
    webgpuF16: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' },
    webgpu: { encoder_model: 'q4', decoder_model_merged: 'q4' },
    wasm: 'q8',
    approxMb: 565,
  },
];

/**
 * Model used when there is no WebGPU (spec section 7, step 3).
 * Phase 1 changed it from whisper-base to whisper-small: base dropped negations
 * ("não foi encontrado" -> "foi encontrado") and had ~21% WER on the PT-BR set.
 */
export const WASM_FALLBACK_MODEL = 'onnx-community/whisper-small';

/** Default model chosen in Phase 1 (docs/fase-1-relatorio.md). */
export const DEFAULT_MODEL = 'onnx-community/whisper-large-v3-turbo';

export function findPreset(id: string): ModelPreset | undefined {
  return MODEL_PRESETS.find((m) => m.id === id);
}

export function shortModelName(id: string): string {
  return id.split('/').pop() ?? id;
}
