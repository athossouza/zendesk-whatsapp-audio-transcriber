/// <reference lib="webworker" />
/**
 * Runs Whisper with Transformers.js (spec section 7). Inference only: decoding,
 * queueing and post-processing live in the offscreen document.
 */
import {
  env,
  InterruptableStoppingCriteria,
  pipeline,
  WhisperTextStreamer,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from '@huggingface/transformers';
import type { Device, Dtype } from '@/src/shared/models';

declare const self: DedicatedWorkerGlobalScope;

export type WorkerIn =
  | { type: 'load'; model: string; device: Device; dtype: Dtype; mirror: string }
  | { type: 'transcribe'; id: string; audio: Float32Array; language: string | null }
  | { type: 'cancel' };

export type WorkerOut =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'loaded'; loadMs: number; modelBytes: number; coldStart: boolean }
  | { type: 'partial'; id: string; text: string }
  | { type: 'done'; id: string; text: string }
  | { type: 'error'; id?: string; name: string; message: string };

// MV3 forbids remote code: ONNX Runtime files ship in the package (public/ort).
env.allowLocalModels = false;
env.useBrowserCache = true;
// With the WASM cache on, Transformers.js imports the ORT factory from a blob: URL,
// which the extension CSP (script-src 'self') blocks.
env.useWasmCache = false;
const ortWasm = env.backends.onnx.wasm;
if (ortWasm) {
  const base = new URL('/ort/', self.location.origin).href;
  ortWasm.wasmPaths = {
    mjs: `${base}ort-wasm-simd-threaded.asyncify.mjs`,
    wasm: `${base}ort-wasm-simd-threaded.asyncify.wasm`,
  };
  ortWasm.numThreads = self.crossOriginIsolated
    ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1))
    : 1;
}

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let loadedKey = '';
const stopper = new InterruptableStoppingCriteria();

function post(msg: WorkerOut): void {
  self.postMessage(msg);
}

async function load(msg: Extract<WorkerIn, { type: 'load' }>): Promise<void> {
  const key = JSON.stringify([msg.model, msg.device, msg.dtype, msg.mirror]);
  if (asr && key === loadedKey) {
    post({ type: 'loaded', loadMs: 0, modelBytes: lastModelBytes, coldStart: false });
    return;
  }
  if (asr) {
    await asr.dispose();
    asr = null;
  }
  env.remoteHost = msg.mirror || 'https://huggingface.co/';

  const started = performance.now();
  // Model already in the browser cache: no "downloading" progress, just loading.
  const fromCache = await isCached(msg.model);
  const files = new Map<string, { loaded: number; total: number }>();
  const onProgress = (p: ProgressInfo): void => {
    if (p.status !== 'progress' && p.status !== 'done') return;
    const info = p as ProgressInfo & { file?: string; loaded?: number; total?: number };
    if (!info.file) return;
    const prev = files.get(info.file) ?? { loaded: 0, total: 0 };
    const total = info.total ?? prev.total;
    const loaded = p.status === 'done' ? total : (info.loaded ?? prev.loaded);
    files.set(info.file, { loaded, total });
    let sumLoaded = 0;
    let sumTotal = 0;
    for (const f of files.values()) {
      sumLoaded += f.loaded;
      sumTotal += f.total;
    }
    if (!fromCache) post({ type: 'progress', loaded: sumLoaded, total: sumTotal });
  };

  asr = (await pipeline('automatic-speech-recognition', msg.model, {
    device: msg.device,
    dtype: msg.dtype as never,
    progress_callback: onProgress,
  })) as AutomaticSpeechRecognitionPipeline;
  loadedKey = key;

  // Warm-up: compiles GPU shaders so the first real request is fast (spec section 7).
  await asr(new Float32Array(16_000), { language: 'portuguese', task: 'transcribe' });

  lastModelBytes = [...files.values()].reduce((s, f) => s + f.total, 0);
  post({
    type: 'loaded',
    loadMs: performance.now() - started,
    modelBytes: lastModelBytes,
    coldStart: true,
  });
}
let lastModelBytes = 0;

/** True when the model's files are already in Transformers.js' Cache Storage. */
async function isCached(model: string): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    return keys.some((r) => r.url.includes(`/${model}/`) && r.url.endsWith('.onnx'));
  } catch {
    return false;
  }
}

async function transcribe(msg: Extract<WorkerIn, { type: 'transcribe' }>): Promise<void> {
  if (!asr) throw new Error('Model not loaded');
  stopper.reset();
  let text = '';
  let lastPost = 0;
  const streamer = new WhisperTextStreamer(asr.tokenizer as never, {
    skip_prompt: true,
    callback_function: (piece: string) => {
      text += piece;
      const now = performance.now();
      // At most one PARTIAL every 150 ms (spec section 11).
      if (now - lastPost >= 150) {
        lastPost = now;
        post({ type: 'partial', id: msg.id, text });
      }
    },
  });

  const longAudio = msg.audio.length > 30 * 16_000;
  const out = await asr(msg.audio, {
    language: msg.language ?? undefined,
    task: 'transcribe',
    ...(longAudio ? { chunk_length_s: 30, stride_length_s: 5 } : {}),
    streamer,
    stopping_criteria: stopper,
  });
  if (stopper.interrupted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
  const result = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text;
  post({ type: 'done', id: msg.id, text: result || text });
}

self.addEventListener('message', (event: MessageEvent<WorkerIn>) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    stopper.interrupt();
    return;
  }
  const run = msg.type === 'load' ? load(msg) : transcribe(msg);
  run.catch((err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err));
    post({
      type: 'error',
      id: msg.type === 'transcribe' ? msg.id : undefined,
      name: e.name,
      message: e.message,
    });
  });
});
