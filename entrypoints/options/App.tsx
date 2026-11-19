import { useEffect, useState } from 'preact/hooks';
import { clearDiscoveryEntries, readDiscoveryReport } from '@/src/shared/discovery-store';
import { buildDiagnostics, managedKeys } from '@/src/shared/diagnostics';
import { MODEL_PRESETS } from '@/src/shared/models';
import { clearModelCache } from '@/src/shared/model-cache';
import { loadSettings, saveSettings, type Settings } from '@/src/shared/settings';
import { clearTranscripts } from '@/src/shared/transcript-cache';
import { TranscriptionTest } from './TranscriptionTest';

type Status = { kind: 'idle' } | { kind: 'ok' | 'error'; text: string };

const LANGUAGES: { value: Settings['language']; label: string }[] = [
  { value: 'portuguese', label: 'Português' },
  { value: 'english', label: 'Inglês' },
  { value: 'spanish', label: 'Espanhol' },
  { value: 'auto', label: 'Detectar automaticamente' },
];

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [locked, setLocked] = useState<string[]>([]);

  const refreshCount = () => readDiscoveryReport().then((r) => setEntryCount(r.entries.length));

  useEffect(() => {
    void loadSettings().then(setSettings);
    void managedKeys().then(setLocked);
    void refreshCount();
    const onChange = (_c: unknown, area: string) => area === 'local' && void refreshCount();
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  if (!settings) return <p>Carregando…</p>;

  const update = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    await saveSettings({ [key]: value });
    setSettings({ ...settings, [key]: value });
  };

  const run = async (action: () => Promise<void>, ok: string, error: string) => {
    try {
      await action();
      setStatus({ kind: 'ok', text: ok });
    } catch {
      setStatus({ kind: 'error', text: error });
    }
  };

  const copyReport = () =>
    run(
      async () => {
        const report = await readDiscoveryReport();
        await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      },
      'Relatório copiado.',
      'Não consegui copiar o relatório.',
    );

  return (
    <main>
      <h1>Transcrever Áudio para Zendesk</h1>
      <p class="muted">
        Versão {chrome.runtime.getManifest().version} · Zendesk:{' '}
        {settings.allowedSubdomains.join(', ')}
      </p>

      <section>
        <h2>Geral</h2>
        {locked.length > 0 && (
          <p class="muted">Algumas opções foram definidas pelo administrador da empresa.</p>
        )}
        <Toggle
          label="Mostrar o ⋯ nos áudios"
          disabled={locked.includes('enabled')}
          checked={settings.enabled}
          onChange={(v) => update('enabled', v)}
        />
        <label class="field">
          Modelo
          <select
            disabled={locked.includes('model')}
            value={settings.model}
            onChange={(e) => update('model', (e.currentTarget as HTMLSelectElement).value)}
          >
            {MODEL_PRESETS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · ~{m.approxMb} MB
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          Idioma dos áudios
          <select
            disabled={locked.includes('language')}
            value={settings.language}
            onChange={(e) =>
              update(
                'language',
                (e.currentTarget as HTMLSelectElement).value as Settings['language'],
              )
            }
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <Toggle
          label="Logs detalhados no console"
          disabled={locked.includes('debug')}
          checked={settings.debug}
          onChange={(v) => update('debug', v)}
        />
      </section>

      <TranscriptionTest model={settings.model} />

      <section>
        <h2>Dados no navegador</h2>
        <div class="actions">
          <button
            type="button"
            class="secondary"
            onClick={() => run(clearTranscripts, 'Transcrições apagadas.', 'Não consegui apagar.')}
          >
            Limpar transcrições
          </button>
          <button
            type="button"
            class="secondary"
            onClick={() =>
              run(clearModelCache, 'Modelos removidos.', 'Não consegui remover os modelos.')
            }
          >
            Remover modelos baixados
          </button>
          <button
            type="button"
            class="secondary"
            onClick={() =>
              run(
                async () => {
                  const diag = await buildDiagnostics();
                  await navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
                },
                'Diagnóstico copiado. Cole na mensagem para o suporte.',
                'Não consegui copiar o diagnóstico.',
              )
            }
          >
            Copiar diagnóstico
          </button>
          <a class="button secondary" href="/benchmark.html" target="_blank">
            Bancada de testes (Fase 1)
          </a>
        </div>
      </section>

      <section>
        <h2>Modo descoberta</h2>
        <p class="muted">
          Com o modo ligado, a extensão não mostra nada no Zendesk. Ela só registra como os áudios
          aparecem na página, sem textos nem nomes de clientes, para ajustar os seletores.
        </p>
        <Toggle
          label="Ligar modo descoberta"
          checked={settings.discoveryMode}
          onChange={(v) => update('discoveryMode', v)}
        />
        <p>
          Áudios registrados: <strong>{entryCount}</strong>
        </p>
        <div class="actions">
          <button type="button" onClick={copyReport}>
            Copiar relatório de descoberta
          </button>
          <button
            type="button"
            class="secondary"
            onClick={() => run(clearDiscoveryEntries, 'Relatório apagado.', 'Erro.')}
          >
            Apagar relatório
          </button>
        </div>
      </section>

      {status.kind !== 'idle' && (
        <p role="status" class={status.kind}>
          {status.text}
        </p>
      )}
    </main>
  );
}

function Toggle(props: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label class="toggle">
      <input
        type="checkbox"
        disabled={props.disabled}
        title={props.disabled ? 'Definido pelo administrador' : undefined}
        checked={props.checked}
        onChange={(e) => props.onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      {props.label}
    </label>
  );
}
