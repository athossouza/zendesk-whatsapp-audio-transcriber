# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Fase 2 · MVP (em andamento)

- Botão ⋯ ao lado do download do player, menu e caixa de transcrição com texto em tempo real (Shadow DOM fechado).
- Nota interna privada com marcador; detecção de transcrição já salva (cache local e notas do ticket).
- Teste ponta a ponta numa página que imita o Agent Workspace, com a API do Zendesk simulada.

### Fase 1 · Teste do motor

- Service worker, offscreen document e Web Worker com Transformers.js v4 (WebGPU e WASM).
- ONNX Runtime dentro do pacote; nenhum código remoto.
- Página "Testar transcrição" e bancada de testes com WER.
- Modelo padrão whisper-large-v3-turbo; reserva sem GPU whisper-small (ver docs/fase-1-relatorio.md).

### Fase 0 · Descoberta

- Projeto WXT + TypeScript strict + Preact + Zod + Vitest, com CI no GitHub Actions.
- Build por cliente (`clients/<cliente>.json`) que gera as permissões e os `matches` do manifest.
- Content script com detecção de áudios pelas 4 estratégias da seção 5 e observação da navegação SPA.
- Modo descoberta: relatório anonimizado da estrutura dos áudios, com teste de download do `blob:`.
- Página de opções com "Copiar relatório de descoberta".
- `selectors.default.json` com os seletores reais do Agent Workspace (ticket 454 da d3v-atveza).
