# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Fase 0 · Descoberta

- Projeto WXT + TypeScript strict + Preact + Zod + Vitest, com CI no GitHub Actions.
- Build por cliente (`clients/<cliente>.json`) que gera as permissões e os `matches` do manifest.
- Content script com detecção de áudios pelas 4 estratégias da seção 5 e observação da navegação SPA.
- Modo descoberta: relatório anonimizado da estrutura dos áudios, com teste de download do `blob:`.
- Página de opções com "Copiar relatório de descoberta".
- `selectors.default.json` com os seletores reais do Agent Workspace (ticket 454 da d3v-atveza).
