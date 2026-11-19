import { useRef, useState } from 'preact/hooks';
import { describeDtype } from '@/src/shared/backend';
import { bytesToBase64 } from '@/src/shared/base64';
import { formatDuration, formatMb, formatSeconds } from '@/src/shared/format';
import { shortModelName } from '@/src/shared/models';
import { requestTranscription, type TranscribeHandle } from '@/src/shared/transcribe-client';
import {
  reduceProgress,
  stateLabel,
  type TranscriptionState,
} from '@/src/shared/transcription-state';

const SAMPLE = '/samples/teste-ptbr.ogg';

/** "Testar transcrição" (spec section 9): transcribes the bundled sample and shows timings. */
export function TranscriptionTest(props: { model: string }) {
  const [state, setState] = useState<TranscriptionState>({ kind: 'idle' });
  const [device, setDevice] = useState<'auto' | 'webgpu' | 'wasm'>('auto');
  const handle = useRef<TranscribeHandle | null>(null);
  const busy = !['idle', 'done', 'error'].includes(state.kind);

  const start = async () => {
    setState({ kind: 'decoding' });
    const bytes = await fetch(chrome.runtime.getURL(SAMPLE)).then((r) => r.arrayBuffer());
    let current: TranscriptionState = { kind: 'decoding' };
    handle.current = requestTranscription(
      {
        audioKey: 'test:sample',
        ticketId: 0,
        subdomain: '',
        base64: bytesToBase64(bytes),
        mime: 'audio/ogg',
        engine: { model: props.model, device },
      },
      (p) => {
        current = reduceProgress(current, p);
        setState(current);
      },
    );
    await handle.current.done;
    handle.current = null;
  };

  return (
    <section>
      <h2>Testar transcrição</h2>
      <p class="muted">
        Transcreve um áudio de exemplo incluído na extensão. Na primeira vez, o modelo é baixado (~
        {shortModelName(props.model)}).
      </p>
      <label class="field">
        Processamento
        <select
          value={device}
          disabled={busy}
          onChange={(e) => setDevice((e.currentTarget as HTMLSelectElement).value as typeof device)}
        >
          <option value="auto">Automático</option>
          <option value="webgpu">Placa de vídeo (WebGPU)</option>
          <option value="wasm">Processador (WASM)</option>
        </select>
      </label>
      <div class="actions">
        <button type="button" disabled={busy} onClick={() => void start()} data-testid="test-start">
          Testar transcrição
        </button>
        {busy && (
          <button type="button" class="secondary" onClick={() => handle.current?.cancel()}>
            Cancelar
          </button>
        )}
      </div>

      <p role="status" aria-live="polite" data-testid="test-status" data-state={state.kind}>
        {stateLabel(state)}
        {state.kind === 'downloading' &&
          ` · ${formatMb(state.loadedBytes)} de ${formatMb(state.totalBytes)}`}
      </p>
      {state.kind === 'downloading' && state.totalBytes > 0 && (
        <progress value={state.loadedBytes} max={state.totalBytes} />
      )}
      {(state.kind === 'transcribing' || state.kind === 'done') && (
        <blockquote data-testid="test-text">
          {state.kind === 'done' ? state.result.text : state.text}
        </blockquote>
      )}
      {state.kind === 'done' && state.result.metrics && (
        <dl class="metrics" data-testid="test-metrics">
          <dt>Modelo</dt>
          <dd>
            {shortModelName(state.result.model)} · {state.result.device} ·{' '}
            {describeDtype(state.result.metrics.dtype)}
          </dd>
          <dt>Áudio</dt>
          <dd>{formatDuration(state.result.audioSeconds)}</dd>
          <dt>Carregar modelo</dt>
          <dd>
            {state.result.metrics.coldStart
              ? `${formatSeconds(state.result.metrics.loadMs)} (${formatMb(state.result.metrics.modelBytes)})`
              : 'já carregado'}
          </dd>
          <dt>Primeira palavra</dt>
          <dd>{formatSeconds(state.result.metrics.firstTextMs)}</dd>
          <dt>Transcrição</dt>
          <dd>{formatSeconds(state.result.metrics.transcribeMs)}</dd>
        </dl>
      )}
    </section>
  );
}
