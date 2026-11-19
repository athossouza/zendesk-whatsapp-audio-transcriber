import { useRef, useState } from 'preact/hooks';
import { summarize, toCsv, type BenchRun } from '@/src/shared/bench';
import { detectGpu } from '@/src/shared/backend';
import { bytesToBase64 } from '@/src/shared/base64';
import { formatPercent, formatSeconds } from '@/src/shared/format';
import { MODEL_PRESETS, type Device } from '@/src/shared/models';
import { clearModelCache } from '@/src/shared/model-cache';
import { requestTranscription } from '@/src/shared/transcribe-client';

interface BenchAudio {
  name: string;
  bytes: ArrayBuffer;
  mime: string;
  reference: string | null;
}

interface SampleManifest {
  samples: { file: string; reference: string }[];
}

declare global {
  interface Window {
    /** Read by the Playwright benchmark script. */
    __bench?: { done: boolean; runs: BenchRun[]; gpu: unknown; isolated: boolean };
  }
}

/**
 * Phase 1 bench (spec section 15): runs every audio through every selected
 * model × device and reports download size, load time, speed and WER.
 */
export function BenchApp() {
  const params = new URLSearchParams(location.search);
  const [models, setModels] = useState<string[]>(
    params.get('models')?.split(',') ?? [MODEL_PRESETS[0]?.id ?? ''],
  );
  const [devices, setDevices] = useState<Device[]>(
    (params.get('devices')?.split(',') as Device[] | undefined) ?? ['webgpu', 'wasm'],
  );
  const [files, setFiles] = useState<BenchAudio[] | null>(null);
  const [runs, setRuns] = useState<BenchRun[]>([]);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const loadSamples = async (): Promise<BenchAudio[]> => {
    const manifest = (await fetch('/samples/bench/manifest.json').then((r) =>
      r.json(),
    )) as SampleManifest;
    return Promise.all(
      manifest.samples.map(async (s) => ({
        name: s.file,
        bytes: await fetch(`/samples/bench/${s.file}`).then((r) => r.arrayBuffer()),
        mime: 'audio/ogg',
        reference: s.reference,
      })),
    );
  };

  const pickFiles = async (list: FileList | null) => {
    if (!list) return;
    const all = [...list];
    const refs = new Map<string, string>();
    for (const f of all.filter((f) => f.name.endsWith('.txt'))) {
      refs.set(f.name.replace(/\.txt$/, ''), await f.text());
    }
    const audios = await Promise.all(
      all
        .filter((f) => !f.name.endsWith('.txt'))
        .map(async (f) => ({
          name: f.name,
          bytes: await f.arrayBuffer(),
          mime: f.type || 'audio/ogg',
          reference: refs.get(f.name.replace(/\.[^.]+$/, '')) ?? null,
        })),
    );
    setFiles(audios);
  };

  const start = async () => {
    cancelled.current = false;
    setRunning(true);
    setRuns([]);
    const gpu = await detectGpu();
    window.__bench = { done: false, runs: [], gpu, isolated: self.crossOriginIsolated };
    const audios = files ?? (await loadSamples());
    const collected: BenchRun[] = [];

    for (const model of models) {
      for (const device of devices) {
        if (device === 'webgpu' && !gpu.webgpu) continue;
        for (const audio of audios) {
          if (cancelled.current) break;
          setStatus(`${model.split('/').pop()} · ${device} · ${audio.name}`);
          const handle = requestTranscription(
            {
              audioKey: `bench:${audio.name}`,
              ticketId: 0,
              subdomain: '',
              base64: bytesToBase64(audio.bytes),
              mime: audio.mime,
              engine: { model, device },
            },
            (p) => {
              if (p.type === 'MODEL_PROGRESS')
                setStatus(
                  `${model.split('/').pop()} · ${device} · baixando ${(p.loadedBytes / 1e6).toFixed(0)}/${(p.totalBytes / 1e6).toFixed(0)} MB`,
                );
            },
          );
          const out = await handle.done;
          const run: BenchRun =
            out.type === 'DONE' && out.result.metrics
              ? {
                  model,
                  device: out.result.device,
                  dtype: out.result.metrics.dtype,
                  file: audio.name,
                  audioSeconds: out.result.audioSeconds,
                  reference: audio.reference,
                  text: out.result.text,
                  loadMs: out.result.metrics.loadMs,
                  coldStart: out.result.metrics.coldStart,
                  modelBytes: out.result.metrics.modelBytes,
                  transcribeMs: out.result.metrics.transcribeMs,
                  firstTextMs: out.result.metrics.firstTextMs,
                  error: null,
                }
              : {
                  model,
                  device,
                  dtype: '?',
                  file: audio.name,
                  audioSeconds: 0,
                  reference: audio.reference,
                  text: '',
                  loadMs: 0,
                  coldStart: false,
                  modelBytes: 0,
                  transcribeMs: 0,
                  firstTextMs: null,
                  error:
                    out.type === 'ERROR' ? `${out.code} ${out.detail ?? ''}`.trim() : 'no-metrics',
                };
          collected.push(run);
          setRuns([...collected]);
          window.__bench.runs = [...collected];
        }
      }
    }
    window.__bench.done = true;
    setStatus(cancelled.current ? 'Cancelado.' : 'Concluído.');
    setRunning(false);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(runs)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bancada-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = summarize(runs);

  return (
    <main class="wide">
      <h1>Bancada de testes (Fase 1)</h1>
      <p class="muted">
        Compara modelos e formas de processamento: tamanho do download, tempo de carga, velocidade e
        taxa de erro de palavras (WER). Metas: texto completo de 60 s em até 15 s e primeira palavra
        em até 5 s.
      </p>

      <section>
        <h2>Configuração</h2>
        <fieldset>
          <legend>Modelos</legend>
          {MODEL_PRESETS.map((m) => (
            <label class="toggle" key={m.id}>
              <input
                type="checkbox"
                checked={models.includes(m.id)}
                disabled={running}
                onChange={() => setModels(toggle(models, m.id))}
              />
              {m.label} (~{m.approxMb} MB)
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Processamento</legend>
          {(['webgpu', 'wasm'] as const).map((d) => (
            <label class="toggle" key={d}>
              <input
                type="checkbox"
                checked={devices.includes(d)}
                disabled={running}
                onChange={() => setDevices(toggle(devices, d))}
              />
              {d === 'webgpu' ? 'Placa de vídeo (WebGPU)' : 'Processador (WASM)'}
            </label>
          ))}
        </fieldset>
        <label class="field">
          Áudios próprios (opcional): selecione os áudios e, para cada um, um .txt com o mesmo nome
          contendo a transcrição correta.
          <input
            type="file"
            multiple
            accept="audio/*,.txt,.ogg,.opus"
            disabled={running}
            onChange={(e) => void pickFiles((e.currentTarget as HTMLInputElement).files)}
          />
        </label>
        <p class="muted">
          {files
            ? `${files.length} áudios selecionados.`
            : 'Sem seleção: usa os áudios de exemplo.'}
        </p>
        <div class="actions">
          <button
            type="button"
            disabled={running}
            onClick={() => void start()}
            data-testid="bench-start"
          >
            Rodar
          </button>
          {running && (
            <button type="button" class="secondary" onClick={() => (cancelled.current = true)}>
              Parar
            </button>
          )}
          <button
            type="button"
            class="secondary"
            disabled={running}
            onClick={() => void clearModelCache().then(() => setStatus('Modelos removidos.'))}
          >
            Remover modelos baixados (medir download)
          </button>
        </div>
        <p role="status" data-testid="bench-status">
          {status}
        </p>
      </section>

      {summary.length > 0 && (
        <section>
          <h2>Resumo</h2>
          <table>
            <thead>
              <tr>
                <th>Configuração</th>
                <th>Download</th>
                <th>Carga (1ª vez)</th>
                <th>Tempo p/ 60 s</th>
                <th>1ª palavra</th>
                <th>WER</th>
                <th>Erros</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.config}>
                  <td>{s.config}</td>
                  <td>{s.modelMb.toFixed(0)} MB</td>
                  <td>{formatSeconds(s.coldLoadMs)}</td>
                  <td class={s.msPer60s !== null && s.msPer60s <= 15_000 ? 'ok' : 'error'}>
                    {formatSeconds(s.msPer60s)}
                  </td>
                  <td
                    class={s.avgFirstTextMs !== null && s.avgFirstTextMs <= 5000 ? 'ok' : 'error'}
                  >
                    {formatSeconds(s.avgFirstTextMs)}
                  </td>
                  <td>{formatPercent(s.wer)}</td>
                  <td>{s.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div class="actions">
            <button type="button" class="secondary" onClick={download}>
              Baixar CSV
            </button>
            <button
              type="button"
              class="secondary"
              onClick={() =>
                void navigator.clipboard.writeText(JSON.stringify({ summary, runs }, null, 2))
              }
            >
              Copiar JSON
            </button>
          </div>
        </section>
      )}

      {runs.length > 0 && (
        <section>
          <h2>Transcrições</h2>
          <table>
            <thead>
              <tr>
                <th>Configuração</th>
                <th>Áudio</th>
                <th>Tempo</th>
                <th>Texto</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i}>
                  <td>
                    {r.model.split('/').pop()} · {r.device}
                  </td>
                  <td>{r.file}</td>
                  <td>{formatSeconds(r.transcribeMs)}</td>
                  <td>{r.error ?? r.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
