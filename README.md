# ATVEZA · Transcrever Áudio para Zendesk

Extensão Chrome (Manifest V3) que transcreve, no computador do agente, os áudios de WhatsApp que chegam aos tickets do Agent Workspace do Zendesk. O modelo Whisper roda no navegador (WebGPU, com WASM como reserva): o áudio não sai da máquina e não há custo por transcrição.

- Especificação (fonte da verdade): [`docs/especificacao-tecnica.md`](docs/especificacao-tecnica.md)
- Relatório da Fase 0: [`docs/fase-0-relatorio.md`](docs/fase-0-relatorio.md)
- Relatório da Fase 1: [`docs/fase-1-relatorio.md`](docs/fase-1-relatorio.md)
- Piloto SKA (Fase 3): [`docs/piloto-ska.md`](docs/piloto-ska.md) · loja: [`docs/chrome-web-store.md`](docs/chrome-web-store.md) · privacidade: [`docs/politica-de-privacidade.md`](docs/politica-de-privacidade.md) · DPO: [`docs/lgpd-dpo.md`](docs/lgpd-dpo.md)

> Mantenha o projeto fora de pastas sincronizadas (iCloud, Drive). O macOS pode tirar arquivos do disco e travar o build.

## Status

| Fase               | Status                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| 0 · Descoberta     | ✅                                                                                                          |
| 1 · Teste do motor | ✅ Modelo padrão: whisper-large-v3-turbo (falta medir numa máquina típica de agente)                        |
| 2 · MVP completo   | ✅ Testado no Zendesk real (d3v-atveza, ticket 454): ⋯, transcrição, nota interna privada                   |
| 3 · Piloto na SKA  | 🚧 Material pronto (build, loja, privacidade, DPO, guia); falta bancada na máquina do agente e os 20 áudios |
| 4 · Liberação      | ⏳                                                                                                          |

## Requisitos

- Node.js 22 (`.nvmrc`)
- Google Chrome ou Edge 124 ou superior

## Desenvolvimento

```bash
npm install
npm run dev          # abre um Chrome com a extensão e recarrega a cada mudança
npm run build        # gera .output/chrome-mv3 (build "dev": d3v-atveza e pdi-atveza)
npm run build:store  # versão da loja: qualquer conta *.zendesk.com (clients/public.json)
npm run store:assets # zip + ícone + capturas na pasta publicacao/
npm run build:ska    # versão restrita à SKA em .output-ska/ (clients/ska.json)
npm run check        # lint + formatação + tipos + testes + build
npm run test:e2e     # Playwright com a extensão carregada (baixa o modelo na 1ª vez)
npm run bench        # bancada da Fase 1 (abre um Chromium visível)
```

### Carregar a extensão no Chrome

1. `npm run build`
2. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta `.output/chrome-mv3`.
4. Depois de cada novo build, clique em ↻ no card da extensão e recarregue a aba do Zendesk.

### Modo descoberta (Fase 0)

1. Nas opções da extensão, ligue **Modo descoberta**.
2. Abra tickets com áudio no Zendesk. No console da página aparecem linhas `[atveza] discovery`.
3. Nas opções, clique em **Copiar relatório de descoberta**. O relatório não tem nomes, textos nem URLs de clientes.

## Estrutura

```
clients/            # configuração por cliente (subdomínios, dicionário)
entrypoints/
  content/          # content script: observa a página e detecta os áudios
  options/          # página de opções (Preact)
src/shared/         # seletores, configurações, descoberta, utilitários
tests/
  fixtures/         # estrutura anonimizada do Agent Workspace
  unit/             # Vitest + jsdom
docs/               # especificação e relatórios por fase
```

## Regras do projeto

As regras da seção 15 da especificação valem para todo o código. As principais:

- Nenhum seletor do Zendesk fica fixo no código: todos vêm de `selectors.default.json`.
- Nenhum código remoto, telemetria ou API de IA externa.
- O texto da transcrição entra na página só via `textContent` (o ESLint bloqueia `innerHTML`).
- Interface em português do Brasil; código e comentários em inglês.
