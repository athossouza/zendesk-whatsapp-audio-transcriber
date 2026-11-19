# Fase 1 · Teste do motor

Data: 2026-11-19 · Transformers.js 4.3.2 · ONNX Runtime Web 1.31 (build asyncify) · Chromium 159 (Playwright), extensão carregada.

## Máquina testada

| Máquina | GPU | WebGPU | `shader-f16` | Isolamento (WASM multithread) |
| --- | --- | --- | --- | --- |
| MacBook, Apple M2, 16 GB | integrada (M2) | sim | sim | sim |

> A especificação pede pelo menos 2 máquinas, uma delas típica dos agentes. Só a primeira foi medida. Para medir uma máquina de agente: instalar a extensão, abrir **Opções → Bancada de testes**, clicar em **Rodar** e depois em **Baixar CSV**.

## Áudios de teste

Seis áudios sintéticos em PT-BR (vozes do macOS), convertidos para OGG/Opus 16 kHz mono 24 kbps como no WhatsApp: 3 s a 50 s, termos técnicos (EDGECAM, dongle, SOLIDWORKS, pós-processador, DriveWorks) e um áudio só com ruído. Estão em `public/samples/bench/`, com a transcrição correta em `manifest.json`.

> Voz sintética é mais fácil que áudio real de WhatsApp (ruído, sotaque, fala rápida). Os 20 áudios reais da SKA (seção 13) continuam necessários. A bancada já aceita áudios próprios mais um `.txt` com a transcrição correta.

## Resultados

| Modelo · processamento · precisão | Download | Carga (1ª vez, com download) | Áudio de 50 s | 1ª palavra (média) | WER | Áudio só com ruído |
| --- | --- | --- | --- | --- | --- | --- |
| whisper-base · WebGPU · enc fp16 / dec q4 | 168 MB | 10,7 s | 4,6 s | 0,3 s | 20,5% | "A" |
| whisper-base · WASM · q8 | 80 MB | 1,6 s* | 3,9 s | 0,9 s | 22,9% | "O que é isso?" |
| whisper-small · WebGPU · enc fp16 / dec q4 | 413 MB | 18,8 s | 8,5 s | 0,6 s | 8,8% | "e" |
| whisper-small · WASM · q8 | 252 MB | 15,2 s | 10,9 s | 2,9 s | 7,8% | "E aí" |
| **whisper-large-v3-turbo · WebGPU · q4f16** | **566 MB** | **30,2 s** | **8,8 s** | **2,5 s** | **2,9%** | **vazio ✓** |

\* já estava em cache, do teste anterior.

Metas da seção 1: 60 s de áudio em até 15 s e primeira palavra em até 5 s. Com o turbo, 50 s levaram 8,8 s (cerca de 10,6 s para 60 s) e a primeira palavra saiu em 2,5 s. Os áudios curtos custam no mínimo ~2,5 s no turbo, porque o Whisper sempre processa uma janela de 30 s.

### O que os números não mostram

No áudio "o dongle **não** foi encontrado":

- **base:** "…que o Dom Glinnon foi encontrado" (perdeu o "não")
- **small:** "…que o Dom Glynno foi encontrado" (perdeu o "não")
- **turbo:** "…que o Dongli **não** foi encontrado" ✓

O base e o small inverteram o sentido da frase. Para o caso de uso (o agente entender sem ouvir), esse é o pior tipo de erro.

## Decisões

1. **Modelo padrão: `whisper-large-v3-turbo`** (WebGPU, q4f16). É o único que acertou a negação e não inventou texto no áudio de ruído, e cumpre as metas de tempo no M2.
2. **Reserva sem WebGPU: `whisper-small` (WASM, q8)**, não o `whisper-base` da especificação. O base erra demais (21–23% de WER e inverte negações). O small em WASM fica perto da meta (cerca de 13 s para 60 s).
3. **A troca automática só vale para modelos mais pesados que a reserva.** Se o agente escolher o base, ele é mantido.
4. **Filtro de "enchimento":** um texto que seja só "a", "e", "E aí", "hum"… vira "Não foi possível identificar fala". Respostas curtas reais, como "Sim.", passam. Uma frase inteira inventada (como "O que é isso?" do base) não é pega por esse filtro. Outro motivo para não usar o base.
5. **Isolamento entre origens** (`cross_origin_embedder_policy` e `cross_origin_opener_policy` no manifest) liga o WASM com várias threads.

## Achados técnicos (regra 9 da especificação)

- O Transformers.js está na **v4**, não na v3. A API usada (`pipeline`, `WhisperTextStreamer`, `InterruptableStoppingCriteria`, `env.backends.onnx.wasm.wasmPaths`) existe com os mesmos nomes.
- Por padrão, a v4 baixa o ONNX Runtime do **jsdelivr** (código remoto). A extensão aponta `wasmPaths` para `ort/` dentro do pacote.
- A v4 guarda o WASM em cache e o importa por URL `blob:`, o que a CSP da extensão bloqueia. Solução: `env.useWasmCache = false`.
- O build "bundle" do ONNX Runtime fazia o Vite empacotar uma segunda cópia do `.wasm` (27 MB). Com a condição `onnxruntime-web-use-extern-wasm`, o pacote ficou em **28 MB**.
- O texto "cdn.jsdelivr.net" continua dentro do código do Transformers.js (é o padrão da biblioteca, sobrescrito antes do uso). Na revisão da Chrome Web Store, explicar que nenhum código remoto é carregado.

## Pendências

- [ ] Rodar a bancada numa máquina típica de agente da SKA (Windows com GPU integrada Intel) e confirmar o turbo como padrão. Se ficar lento, usar o small como padrão.
- [ ] Rodar a bancada com os 20 áudios reais da SKA.
