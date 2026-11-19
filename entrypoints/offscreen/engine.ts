import { TranscriberError } from '@/src/shared/errors';
import type { Device, Dtype } from '@/src/shared/models';
import type { WorkerIn, WorkerOut } from './whisper.worker';

export interface LoadInfo {
  loadMs: number;
  modelBytes: number;
  coldStart: boolean;
}

const CANCEL_GRACE_MS = 3000;

/**
 * Owns the Whisper Web Worker. One operation at a time; the offscreen queue
 * guarantees that.
 */
export class Engine {
  private worker: Worker | null = null;
  private pending: {
    onMessage: (m: WorkerOut) => void;
    reject: (e: unknown) => void;
  } | null = null;
  private cancelTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onModelProgress: (loaded: number, total: number) => void) {}

  load(model: string, device: Device, dtype: Dtype, mirror: string): Promise<LoadInfo> {
    return this.run({ type: 'load', model, device, dtype, mirror }, (m, resolve) => {
      if (m.type === 'progress') this.onModelProgress(m.loaded, m.total);
      if (m.type === 'loaded')
        resolve({ loadMs: m.loadMs, modelBytes: m.modelBytes, coldStart: m.coldStart });
    });
  }

  transcribe(
    id: string,
    audio: Float32Array,
    language: string | null,
    onPartial: (text: string) => void,
  ): Promise<{ text: string; firstTextMs: number | null }> {
    const started = performance.now();
    let firstTextMs: number | null = null;
    return this.run(
      { type: 'transcribe', id, audio, language },
      (m, resolve) => {
        if (m.type === 'partial') {
          firstTextMs ??= performance.now() - started;
          onPartial(m.text);
        }
        if (m.type === 'done') resolve({ text: m.text, firstTextMs });
      },
      [audio.buffer as ArrayBuffer],
    );
  }

  /** Asks the worker to stop; kills it if it does not stop in 3 s (spec section 7). */
  cancel(): void {
    if (!this.pending || !this.worker) return;
    this.worker.postMessage({ type: 'cancel' } satisfies WorkerIn);
    this.cancelTimer ??= setTimeout(() => {
      this.terminate();
    }, CANCEL_GRACE_MS);
  }

  /** Frees the worker (and GPU memory). The model stays in the browser cache. */
  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    const pending = this.pending;
    this.pending = null;
    pending?.reject(new TranscriberError('CANCELLED'));
    this.clearCancelTimer();
  }

  get busy(): boolean {
    return this.pending !== null;
  }

  private run<T>(
    msg: WorkerIn,
    handle: (m: WorkerOut, resolve: (v: T) => void) => void,
    transfer: Transferable[] = [],
  ): Promise<T> {
    if (this.pending) return Promise.reject(new Error('Engine busy'));
    const worker = this.ensureWorker();
    return new Promise<T>((resolve, reject) => {
      const finish = (fn: () => void) => {
        this.pending = null;
        this.clearCancelTimer();
        fn();
      };
      this.pending = {
        onMessage: (m) => {
          if (m.type === 'error') {
            const err =
              m.name === 'AbortError'
                ? new TranscriberError('CANCELLED')
                : Object.assign(new Error(m.message), { name: m.name });
            finish(() => reject(err));
            return;
          }
          handle(m, (v) => finish(() => resolve(v)));
        },
        reject,
      };
      worker.postMessage(msg, transfer);
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (e: MessageEvent<WorkerOut>) =>
      this.pending?.onMessage(e.data),
    );
    worker.addEventListener('error', (e) => {
      const pending = this.pending;
      this.pending = null;
      this.worker = null;
      pending?.reject(new Error(e.message || 'Worker crashed'));
    });
    this.worker = worker;
    return worker;
  }

  private clearCancelTimer(): void {
    if (this.cancelTimer) clearTimeout(this.cancelTimer);
    this.cancelTimer = null;
  }
}
