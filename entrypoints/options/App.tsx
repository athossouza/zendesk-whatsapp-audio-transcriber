import { useEffect, useState } from 'preact/hooks';
import { clearDiscoveryEntries, readDiscoveryReport } from '@/src/shared/discovery-store';
import { loadSettings, saveSettings, type Settings } from '@/src/shared/settings';

type Status = { kind: 'idle' } | { kind: 'ok' | 'error'; text: string };

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const refreshCount = () => readDiscoveryReport().then((r) => setEntryCount(r.entries.length));

  useEffect(() => {
    void loadSettings().then(setSettings);
    void refreshCount();
    const onChange = (_c: unknown, area: string) => area === 'local' && void refreshCount();
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  if (!settings) return <p>Carregando…</p>;

  const toggle = async (key: 'discoveryMode' | 'debug' | 'enabled', value: boolean) => {
    await saveSettings({ [key]: value });
    setSettings({ ...settings, [key]: value });
  };

  const copyReport = async () => {
    try {
      const report = await readDiscoveryReport();
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setStatus({ kind: 'ok', text: `Relatório copiado (${report.entries.length} áudios).` });
    } catch {
      setStatus({ kind: 'error', text: 'Não consegui copiar o relatório.' });
    }
  };

  const clearReport = async () => {
    await clearDiscoveryEntries();
    setStatus({ kind: 'ok', text: 'Relatório apagado.' });
  };

  return (
    <main>
      <h1>Transcrever Áudio para Zendesk</h1>
      <p class="muted">
        Versão {chrome.runtime.getManifest().version} · Zendesk:{' '}
        {settings.allowedSubdomains.join(', ')}
      </p>

      <section>
        <h2>Geral</h2>
        <Toggle
          label="Mostrar o ⋯ nos áudios"
          checked={settings.enabled}
          onChange={(v) => toggle('enabled', v)}
        />
        <Toggle
          label="Logs detalhados no console"
          checked={settings.debug}
          onChange={(v) => toggle('debug', v)}
        />
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
          onChange={(v) => toggle('discoveryMode', v)}
        />
        <p>
          Áudios registrados: <strong>{entryCount}</strong>
        </p>
        <div class="actions">
          <button type="button" onClick={copyReport}>
            Copiar relatório de descoberta
          </button>
          <button type="button" class="secondary" onClick={clearReport}>
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

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="toggle">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      {props.label}
    </label>
  );
}
