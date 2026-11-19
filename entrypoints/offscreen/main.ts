/**
 * Offscreen document (spec section 4): decodes audio, keeps a FIFO queue,
 * drives the Whisper worker and post-processes the text.
 */
import { base64ToBytes } from '@/src/shared/base64';
import { chooseEngine, detectGpu, type EngineChoice } from '@/src/shared/backend';
import { classifyError, TranscriberError } from '@/src/shared/errors';
import {
  isOwnSender,
  ToOffscreenSchema,
  type OffTranscribe,
  type Progress,
  type TranscriptResult,
} from '@/src/shared/messages';
import { postprocess } from '@/src/shared/postprocess';
import { decodeTo16kMono } from './decode';
import { Engine } from './engine';

const MAX_QUEUE = 5;
const IDLE_CLOSE_MS = 10 * 60 * 1000;

interface Job {
  req: OffTranscribe;
  /** Requests sharing the same audioKey reuse one job (spec section 7). */
  requestIds: Set<string>;
  receivedAt: number;
}

const queue: Job[] = [];
let current: Job | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const engine = new Engine((loaded, total) => {
  if (current)
    emit(current, (requestId) => ({
      type: 'MODEL_PROGRESS',
      requestId,
      loadedBytes: loaded,
      totalBytes: total,
    }));
});

function send(msg: Progress | { type: 'OFF_IDLE' }): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Service worker not listening (e.g. restarting): nothing to do.
  });
}

function emit(job: Job, build: (requestId: string) => Progress): void {
  for (const id of job.requestIds) send(build(id));
}

chrome.runtime.onMessage.addListener((raw: unknown, sender) => {
  if (!isOwnSender(sender)) return;
  const parsed = ToOffscreenSchema.safeParse(raw);
  if (!parsed.success) return;
  const msg = parsed.data;
  if (msg.type === 'OFF_CANCEL') cancel(msg.requestId);
  else enqueue(msg);
});

function enqueue(req: OffTranscribe): void {
  touchIdle();
  const same = [current, ...queue].find(
    (j) =>
      j?.req.audioKey === req.audioKey &&
      j.req.model === req.model &&
      j.req.device === req.device &&
      !req.audioKey.startsWith('bench:'),
  );
  if (same) {
    same.requestIds.add(req.requestId);
    return;
  }
  if (queue.length >= MAX_QUEUE) {
    send({ type: 'ERROR', requestId: req.requestId, code: 'QUEUE_FULL' });
    return;
  }
  queue.push({ req, requestIds: new Set([req.requestId]), receivedAt: performance.now() });
  if (current) send({ type: 'STAGE', requestId: req.requestId, stage: 'queued' });
  void pump();
}

function cancel(requestId: string): void {
  const queued = queue.find((j) => j.requestIds.has(requestId));
  if (queued) {
    queued.requestIds.delete(requestId);
    if (!queued.requestIds.size) queue.splice(queue.indexOf(queued), 1);
  } else if (current?.requestIds.has(requestId)) {
    current.requestIds.delete(requestId);
    if (!current.requestIds.size) engine.cancel();
  }
  send({ type: 'ERROR', requestId, code: 'CANCELLED' });
}

async function pump(): Promise<void> {
  if (current) return;
  const job = queue.shift();
  if (!job) {
    touchIdle();
    return;
  }
  current = job;
  try {
    const result = await runJob(job);
    emit(job, (requestId) => ({ type: 'DONE', requestId, result }));
  } catch (err) {
    const code = classifyError(err);
    const detail =
      err instanceof TranscriberError
        ? err.detail
        : err instanceof Error
          ? err.message.slice(0, 500)
          : undefined;
    if (code !== 'CANCELLED')
      emit(job, (requestId) => ({ type: 'ERROR', requestId, code, detail }));
  } finally {
    current = null;
    void pump();
  }
}

async function runJob(job: Job): Promise<TranscriptResult> {
  const { req } = job;
  const gpu = await detectGpu();
  let choice = chooseEngine({ model: req.model, device: req.device, dtype: req.dtype }, gpu);

  emit(job, (requestId) => ({ type: 'STAGE', requestId, stage: 'decoding' }));
  const decodeStart = performance.now();
  const bytes = base64ToBytes(req.base64);
  const { audio, seconds } = await decodeTo16kMono(bytes.buffer, req.mime);
  const decodeMs = performance.now() - decodeStart;
  if (seconds > req.maxAudioMinutes * 60) throw new TranscriberError('AUDIO_TOO_LONG');

  try {
    return await infer(job, choice, audio, seconds, decodeMs);
  } catch (err) {
    // GPU lost: switch to WASM and retry once (spec section 12).
    if (choice.device !== 'webgpu' || classifyError(err) !== 'GPU_LOST') throw err;
    engine.terminate();
    choice = chooseEngine({ model: req.model, device: 'wasm' }, gpu);
    const retry = await decodeTo16kMono(base64ToBytes(req.base64).buffer, req.mime);
    return infer(job, choice, retry.audio, seconds, decodeMs);
  }
}

async function infer(
  job: Job,
  choice: EngineChoice,
  audio: Float32Array,
  seconds: number,
  decodeMs: number,
): Promise<TranscriptResult> {
  const { req } = job;
  emit(job, (requestId) => ({
    type: 'STAGE',
    requestId,
    stage: 'loading-model',
    device: choice.device,
    downgraded: choice.downgraded,
  }));
  const load = await engine.load(choice.model, choice.device, choice.dtype, req.modelMirror);

  emit(job, (requestId) => ({
    type: 'STAGE',
    requestId,
    stage: 'transcribing',
    device: choice.device,
  }));
  const started = performance.now();
  const { text: raw, firstTextMs } = await engine.transcribe(
    req.requestId,
    audio,
    req.language,
    (text) => emit(job, (requestId) => ({ type: 'PARTIAL', requestId, text: text.trim() })),
  );
  const transcribeMs = performance.now() - started;

  return {
    audioKey: req.audioKey,
    subdomain: req.subdomain,
    ticketId: req.ticketId,
    // Empty text means NO_SPEECH; the UI shows the message (spec section 7, step 4).
    text: postprocess(raw, {
      hallucinationFilters: req.hallucinationFilters,
      replacements: req.replacements,
    }),
    model: choice.model,
    device: choice.device,
    language: req.language,
    audioSeconds: seconds,
    elapsedMs: performance.now() - job.receivedAt,
    createdAt: new Date().toISOString(),
    savedAsNote: false,
    downgraded: choice.downgraded,
    metrics: {
      dtype: choice.dtype,
      modelBytes: load.modelBytes,
      coldStart: load.coldStart,
      loadMs: load.loadMs,
      decodeMs,
      firstTextMs,
      transcribeMs,
      rawText: raw,
    },
  };
}

/** After 10 idle minutes, ask the service worker to close this document (spec section 4). */
function touchIdle(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!current && !queue.length) send({ type: 'OFF_IDLE' });
  }, IDLE_CLOSE_MS);
}

touchIdle();
