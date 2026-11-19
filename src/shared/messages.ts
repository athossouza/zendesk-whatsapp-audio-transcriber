import { z } from 'zod';
import { ErrorCodeSchema } from './errors';
import { DtypeSchema } from './models';

/**
 * Message contracts (spec section 11). Every message crossing a component
 * boundary is validated with these schemas.
 *
 * Transport:
 * - content script / extension pages <-> service worker: a long-lived Port named
 *   `TRANSCRIBE_PORT` (keeps the worker alive while progress flows and routes
 *   progress back without needing the `tabs` permission);
 * - service worker <-> offscreen document: chrome.runtime.sendMessage.
 */
export const TRANSCRIBE_PORT = 'transcribe';

const RequestId = z.string().min(1).max(100);
const MAX_BASE64 = 36 * 1024 * 1024; // 25 MB of audio, base64-encoded

export const EngineRequestSchema = z.object({
  model: z.string().min(1).max(200).optional(),
  device: z.enum(['auto', 'webgpu', 'wasm']).optional(),
  dtype: DtypeSchema.optional(),
});

export const MetricsSchema = z.object({
  dtype: DtypeSchema,
  /** Bytes of model files (downloaded or read from cache). */
  modelBytes: z.number().nonnegative(),
  /** Whether the pipeline had to be (re)loaded for this request. */
  coldStart: z.boolean(),
  loadMs: z.number().nonnegative(),
  decodeMs: z.number().nonnegative(),
  firstTextMs: z.number().nonnegative().nullable(),
  transcribeMs: z.number().nonnegative(),
  rawText: z.string(),
});
export type Metrics = z.infer<typeof MetricsSchema>;

/** Spec section 9 (`CachedTranscript`), plus Phase 1 metrics. */
export const TranscriptResultSchema = z.object({
  audioKey: z.string(),
  subdomain: z.string(),
  ticketId: z.number().int(),
  text: z.string(),
  model: z.string(),
  device: z.enum(['webgpu', 'wasm']),
  language: z.string().nullable(),
  audioSeconds: z.number().nonnegative(),
  elapsedMs: z.number().nonnegative(),
  createdAt: z.string(),
  savedAsNote: z.boolean(),
  downgraded: z.boolean(),
  metrics: MetricsSchema.optional(),
});
export type TranscriptResult = z.infer<typeof TranscriptResultSchema>;

// content script / pages -> service worker (over the port)
export const ToBackgroundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TRANSCRIBE'),
    requestId: RequestId,
    audioKey: z.string().min(1).max(200),
    ticketId: z.number().int().nonnegative(),
    subdomain: z.string().max(100),
    src: z.string().max(2000).optional(),
    base64: z.string().max(MAX_BASE64).optional(),
    mime: z.string().max(100).optional(),
    engine: EngineRequestSchema.optional(),
  }),
  z.object({ type: z.literal('CANCEL'), requestId: RequestId }),
]);
export type ToBackground = z.infer<typeof ToBackgroundSchema>;
export type TranscribeRequest = Extract<ToBackground, { type: 'TRANSCRIBE' }>;

// service worker -> offscreen document
export const ToOffscreenSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('OFF_TRANSCRIBE'),
    requestId: RequestId,
    audioKey: z.string(),
    ticketId: z.number().int(),
    subdomain: z.string(),
    base64: z.string().max(MAX_BASE64),
    mime: z.string().optional(),
    model: z.string().min(1),
    device: z.enum(['auto', 'webgpu', 'wasm']),
    dtype: DtypeSchema.optional(),
    language: z.string().nullable(),
    maxAudioMinutes: z.number().positive(),
    modelMirror: z.string(),
    replacements: z.array(z.object({ from: z.string(), to: z.string() })),
    hallucinationFilters: z.array(z.string()),
  }),
  z.object({ type: z.literal('OFF_CANCEL'), requestId: RequestId }),
]);
export type ToOffscreen = z.infer<typeof ToOffscreenSchema>;
export type OffTranscribe = Extract<ToOffscreen, { type: 'OFF_TRANSCRIBE' }>;

// offscreen -> service worker -> client
export const ProgressSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MODEL_PROGRESS'),
    requestId: RequestId,
    loadedBytes: z.number().nonnegative(),
    totalBytes: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal('STAGE'),
    requestId: RequestId,
    stage: z.enum(['queued', 'loading-model', 'decoding', 'transcribing']),
    device: z.enum(['webgpu', 'wasm']).optional(),
    downgraded: z.boolean().optional(),
  }),
  z.object({ type: z.literal('PARTIAL'), requestId: RequestId, text: z.string() }),
  z.object({ type: z.literal('DONE'), requestId: RequestId, result: TranscriptResultSchema }),
  z.object({
    type: z.literal('ERROR'),
    requestId: RequestId,
    code: ErrorCodeSchema,
    detail: z.string().max(2000).optional(),
  }),
]);
export type Progress = z.infer<typeof ProgressSchema>;

/** offscreen -> service worker housekeeping. */
export const OffscreenEventSchema = z.object({ type: z.literal('OFF_IDLE') });

/** True when a runtime message comes from this extension (spec section 10, rule 2). */
export function isOwnSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}
