# Especificação Técnica — Extensão Chrome "Transcrever Áudio" para Zendesk

Nov 19, 2026 · @Athos Alves De Souza

## 1. Missão e objetivos

**Missão:** permitir que o agente do Zendesk entenda um áudio de cliente em segundos, sem ouvi-lo, com um clique discreto no próprio áudio, sem custo de uso e sem que o áudio saia do computador do agente.

**Problema.** Os clientes mandam áudios pelo WhatsApp, que chegam aos tickets de mensagens do Agent Workspace. O Zendesk só toca o áudio: não transcreve. Por isso o agente:

- precisa ouvir cada áudio, muitas vezes em ambiente sem fone;
- não consegue buscar nem copiar o conteúdo;
- não tem o texto para o resumo e a classificação do Copilot ou para o histórico do ticket.

**Objetivos do produto**

1. Botão discreto (⋯) ao lado de cada áudio no corpo do ticket, com a ação "Transcrever".
2. Transcrição exibida numa caixa semitransparente junto do áudio, com o texto aparecendo enquanto é gerado.
3. Opção de salvar a transcrição como nota interna, para ela ficar no ticket.
4. Custo zero por transcrição: o modelo de IA roda no navegador do agente.
5. Privacidade: o áudio é processado só na máquina do agente.

**Métricas de sucesso (medidas na prova de conceito)**

| Métrica | Meta |
| --- | --- |
| Tempo até o texto completo, áudio de 60 s, máquina com GPU | até 15 s |
| Tempo até a primeira palavra aparecer | até 5 s, com o modelo já baixado |
| Qualidade em PT-BR, áudios reais da SKA | agente entende sem ouvir em 9 de 10 áudios |
| Botão aparece nos áudios de WhatsApp | 100% dos áudios visíveis na conversa |
| Custo por transcrição | R$ 0 |

As metas de tempo são hipóteses a validar na Fase 1 (seção 15), não garantias.

## 2. Escopo e premissas

O MVP entrega o ciclo completo para um áudio: detectar, transcrever, mostrar, copiar e salvar como nota interna. Primeiro cliente: SKA Suporte (skasuporte.zendesk.com). Ambiente de testes: pdi-atveza.

**Dentro do MVP**

- Google Chrome e Edge (Chromium) para desktop, versão 124 ou superior, extensão Manifest V3.
- Agent Workspace do Zendesk, tickets de mensagens (WhatsApp em primeiro lugar) e também anexos de áudio em tickets de e-mail.
- Formatos: OGG/Opus (WhatsApp), MP3, M4A/AAC, WAV, WebM. AMR só se o navegador conseguir decodificar.
- Botão ⋯, menu, caixa de transcrição, copiar, salvar como nota interna, cache local.
- Transcrição 100% local com Whisper via Transformers.js (WebGPU, com WASM como reserva).
- Página de opções com as configurações da seção 9.
- Configuração de seletores atualizável sem publicar nova versão (seção 5).

**Fora do MVP (fases seguintes)**

- Transcrição automática ao abrir o ticket (o MVP já deixa a opção prevista, mas desligada).
- Tradução, resumo do áudio ou sugestão de resposta.
- Identificação de quem fala e marcação de tempo por frase.
- Firefox e Safari.
- App na barra lateral (App Builder) como alternativa oficial.
- Modelos NVIDIA (Parakeet/Canary): avaliar depois do MVP, porque o Transformers.js não dá suporte oficial a eles.
- Painel central de uso ou telemetria.

**Premissas**

1. O agente já está logado no Zendesk. A extensão usa a sessão dele e nunca pede ou guarda senha ou token.
2. A estrutura da página do Agent Workspace não é documentada e pode mudar sem aviso. A extensão precisa tolerar isso (seções 5 e 12).
3. Na primeira vez, o modelo é baixado da Hugging Face (ou de um espelho configurado) e fica guardado no navegador.
4. A estrutura exata dos áudios na página e a origem dos arquivos ainda são desconhecidas. A Fase 0 (seção 15) existe para descobri-las antes de escrever os seletores definitivos.

## 3. Experiência do usuário

O agente nunca sai do ticket: clica no ⋯ ao lado do áudio, escolhe "Transcrever" e lê o texto numa caixa logo abaixo do player.

**Fluxo principal**

1. O agente abre um ticket com áudio. Ao lado do ícone de download do player aparece o botão ⋯.
2. Clique no ⋯ abre um menu com: "Transcrever", "Copiar transcrição" (desativado até existir transcrição) e "Salvar como nota interna" (idem).
3. Em "Transcrever", a caixa abre logo abaixo do áudio e mostra o andamento (tabela de estados abaixo).
4. O texto aparece enquanto é gerado. Ao terminar, a caixa mostra os botões Copiar, Salvar como nota interna e Fechar.
5. Em "Salvar como nota interna", a extensão grava a nota no ticket e mostra "Salva no ticket".
6. Se o áudio já tiver transcrição (no cache local ou em nota interna), o ⋯ ganha um pequeno ponto de destaque e "Transcrever" vira "Ver transcrição", que abre na hora.

**Botão ⋯**

- 24 × 24 px, ícone de três pontos horizontais, transparente com opacidade de 60%. Fica 100% opaco ao passar o mouse e com foco visível no teclado.
- `aria-label="Mais ações do áudio"`, `aria-haspopup="menu"`. Abre com Enter ou espaço.
- Não muda o tamanho nem o layout do player. Se não houver espaço, fica sobreposto no canto superior direito do balão.

**Caixa de transcrição**

- Ancorada logo abaixo do player, com a mesma largura do balão (mínimo 280 px, máximo 560 px).
- Altura acompanha o texto até 50% da altura da janela; acima disso, rola por dentro.
- Visual: fundo semitransparente (branco a 85% no tema claro, cinza escuro a 85% no escuro), `backdrop-filter: blur(8px)`, borda de 1 px, cantos de 8 px, sombra leve, fonte do sistema 14 px.
- Cabeçalho pequeno: "Transcrição", duração do áudio e modelo usado (ex.: "0:06 · whisper-small").
- Rodapé discreto: "Gerado por IA no seu computador. Confira antes de usar."
- Fecha com Esc, com o botão Fechar ou ao clicar no ⋯ de novo. O foco volta para o ⋯.
- Acompanha o áudio quando a conversa rola, e fecha sozinha se o áudio sair da página.
- Em teclado, Tab percorre os botões da caixa. A caixa usa `role="dialog"` sem bloquear o resto da página.

**Estados da caixa**

| Estado | O que o agente vê | Ações disponíveis |
| --- | --- | --- |
| Baixando modelo (só na primeira vez) | "Preparando a transcrição (só na primeira vez)" + barra com % e MB | Cancelar |
| Carregando áudio | "Lendo o áudio" | Cancelar |
| Transcrevendo | Texto aparecendo + indicador animado | Cancelar |
| Concluído | Texto completo | Copiar, Salvar como nota interna, Transcrever de novo, Fechar |
| Salvando nota | "Salvando no ticket" | nenhuma |
| Nota salva | "Salva no ticket" com check | Copiar, Fechar |
| Erro | Mensagem em português simples (seção 12) | Tentar de novo, Fechar |

**Texto da nota interna**

```
Transcrição do áudio de {autor} ({data hora}, {duração})

{texto}

—
Gerada por IA no computador do agente ({modelo}). Pode conter erros.
[atveza-transcricao:{audioKey}]
```

A última linha é o marcador que permite reconhecer, ao reabrir o ticket, que aquele áudio já tem transcrição salva (seção 9).

## 4. Arquitetura (Manifest V3)

A extensão tem três partes que conversam por mensagens: o content script cuida da tela, o service worker coordena e baixa arquivos, e o offscreen document roda a IA.

&#91;embedded content: arquitetura da extensão · 3 componentes, 3 serviços externos\]

O áudio sai da aba do Zendesk, passa pelo service worker e é transcrito no offscreen document. Nada vai para servidores externos; a única coisa baixada de fora é o modelo, uma vez.

**Por que três partes**

| Componente | Responsabilidade | Por que fica aqui |
| --- | --- | --- |
| Content script (`content.ts`) | Observar a página, achar os áudios, injetar o ⋯, menu e caixa, ler a URL do ticket, salvar a nota interna | Só ele enxerga e altera a página do Zendesk. A nota é salva daqui porque a chamada sai da mesma origem e usa a sessão do agente |
| Service worker (`background.ts`) | Rotear mensagens, baixar o áudio quando o content script não conseguir, guardar o cache, buscar a configuração de seletores, criar e fechar o offscreen document | Tem as permissões de host e não sofre bloqueio de CORS. Não tem acesso a Web Audio, por isso não decodifica |
| Offscreen document (`offscreen.html` + `offscreen.ts`) | Decodificar o áudio com Web Audio, reamostrar para 16 kHz mono e rodar o Whisper num Web Worker | O service worker pode ser encerrado pelo Chrome a qualquer momento e não tem Web Audio. O offscreen document fica vivo durante a transcrição e mantém o modelo carregado na memória |
| Web Worker (`whisper.worker.ts`) | Carregar o pipeline do Transformers.js e transcrever | Evita travar a interface durante a inferência |
| Página de opções (`options.html`) | Configurações do usuário (seção 9) | Padrão do Chrome para extensões |

**Ciclo de vida do offscreen document**

- Criado sob demanda na primeira transcrição, com `chrome.offscreen.createDocument({ reasons: ['WORKERS', 'BLOBS'], justification: 'Transcrição local de áudio com Whisper' })`.
- Só pode existir um. Antes de criar, verificar com `chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })`.
- Fechado depois de 10 minutos sem uso, para liberar memória e GPU. O modelo continua no cache em disco e recarrega em poucos segundos.

## 5. Detecção dos áudios e injeção do botão

A extensão acha os áudios por regras guardadas num JSON de configuração, nunca por classes CSS fixas no código, porque o Zendesk muda a página sem avisar.

**Observação da página**

1. O content script roda em `https://*.zendesk.com/agent/*` com `run_at: document_idle`, `all_frames: false`.
2. O Agent Workspace troca de ticket sem recarregar a página. A extensão detecta a troca com o evento `navigate` da Navigation API e, como reserva, comparando `location.pathname` a cada 1 s.
3. Um `MutationObserver` em `document.body` (`childList: true, subtree: true`) dispara uma varredura, limitada a no máximo uma a cada 300 ms. A varredura também roda ao trocar de ticket.
4. Cada áudio processado recebe `data-atveza-audio="<audioKey>"`, para não receber dois botões.
5. O ID do ticket vem da URL: `/agent/tickets/(\d+)`. Sem ID, não injeta nada.

**Estratégias de detecção, em ordem de preferência**

| # | Estratégia | Como reconhece | Estabilidade esperada |
| --- | --- | --- | --- |
| 1 | Elemento `<audio>` | `audio[src]` ou `audio > source[src]` dentro da área da conversa | Alta |
| 2 | Atributos de teste do Zendesk | Seletores `[data-test-id*="audio" i]` ou similares, descobertos na Fase 0 | Média |
| 3 | Link de anexo de áudio | `a[href]` cujo caminho termina em `.ogg`, `.opus`, `.mp3`, `.m4a`, `.aac`, `.wav`, `.webm`, `.amr`, ou que tenha `type` ou `download` com MIME `audio/*` | Média |
| 4 | Rótulo de texto | Balão que contém o texto "Gravação de WhatsApp" (e variações do arquivo de config) com um botão de play | Baixa, usada só como reserva |

Para cada áudio encontrado, a extensão monta um `AudioCandidate`: o elemento do player, o URL do arquivo (se houver), o autor e a data da mensagem (se der para ler) e o ponto onde o botão será colocado.

**Onde o botão entra**

- Preferido: logo depois do botão de download do player, encontrado por `aria-label` ou `title` que contenha "download" ou "baixar".
- Reserva: posicionado de forma absoluta no canto superior direito do balão da mensagem.
- O botão e a caixa vivem dentro de um host `<atveza-audio-tools>` com Shadow DOM fechado (`mode: 'closed'`), para o CSS do Zendesk não afetar a extensão e vice-versa.

**Arquivo de configuração de seletores (`selectors.json`)**

```json
{
  "version": 1,
  "updatedAt": "2026-11-19",
  "conversationRoot": ["[data-test-id='omni-log-container']", "[role='log']", "main"],
  "audioElements": ["audio[src]", "audio source[src]"],
  "audioContainers": ["[data-test-id*='audio' i]"],
  "audioLinkExtensions": ["ogg", "opus", "mp3", "m4a", "aac", "wav", "webm", "amr"],
  "textLabels": ["Gravação de WhatsApp", "WhatsApp recording", "Voice message"],
  "downloadButton": ["button[aria-label*='download' i]", "a[download]", "[title*='baixar' i]"],
  "messageBubble": ["[data-test-id*='message' i]", "article", "li"],
  "messageAuthor": ["[data-test-id*='author' i]"],
  "messageTime": ["time[datetime]"]
}
```

Os seletores acima são exemplos de formato. Os valores reais saem da Fase 0.

**Regras do arquivo de configuração**

- Uma cópia padrão vai dentro da extensão.
- O service worker busca uma versão remota na URL definida nas opções (ex.: um arquivo da ATVEZA no GitHub) ao iniciar e a cada 6 horas.
- A versão remota só é aceita se passar na validação de esquema (Zod) e tiver `version` maior que a atual. Se não passar, fica a última válida.
- O arquivo contém apenas dados (seletores e textos). Nunca código: a Chrome Web Store proíbe código remoto no Manifest V3.

**Modo descoberta (Fase 0)**

Com a opção "Modo descoberta" ligada, a extensão não injeta nada. Para cada `<audio>`, link de áudio ou rótulo encontrado, ela registra no console:

- a cadeia de elementos até a raiz da conversa, com tag, `data-test-id`, `role`, `aria-label` e classes;
- o `src` e o domínio do arquivo de áudio;
- o HTML externo do balão, com textos trocados por `***` para não expor dados de cliente.

Também há um botão "Copiar relatório" na página de opções, que gera esse relatório em JSON para escrever o `selectors.json` definitivo.

## 6. Obtenção e decodificação do áudio

O service worker baixa o arquivo; o offscreen document converte para 16 kHz mono, o formato que o Whisper espera. O content script só baixa quando o service worker não consegue.

**Identificação do áudio (`audioKey`)**

- `audioKey = sha256(subdominio + ':' + ticketId + ':' + urlCanonica)`, em hexadecimal, primeiros 32 caracteres.
- `urlCanonica` = URL do arquivo sem parâmetros de assinatura ou expiração (remover a query string inteira, a menos que a Fase 0 mostre que ela identifica o arquivo).
- Sem URL (ex.: `blob:`), usar `ticketId + horário da mensagem + duração do áudio`.
- A chave é calculada antes do download, para consultar o cache sem baixar nada.

**Ordem de tentativas para baixar**

1. **Service worker:** `fetch(src, { credentials: 'include' })`. Funciona para URLs de domínios listados em `host_permissions`, sem bloqueio de CORS.
2. **Content script:** se o passo 1 falhar com 401, 403, erro de rede ou se o `src` for `blob:`, o content script faz o `fetch` na própria página, converte para base64 e envia ao service worker.
3. **Erro:** se os dois falharem, mostrar o erro `AUDIO_FETCH_FAILED` (seção 12).

**Limites**

- Tamanho máximo: 25 MB. Duração máxima no MVP: 10 minutos (configurável). Acima disso, erro `AUDIO_TOO_LONG`.
- Os bytes viajam entre componentes em base64 (mensagens do Chrome só aceitam JSON). Áudios de WhatsApp têm poucas centenas de KB, então o custo é desprezível.
- O arquivo baixado fica só na memória e é descartado ao final. Nunca é gravado em disco.

**Decodificação (no offscreen document)**

```ts
async function decodeTo16kMono(bytes: ArrayBuffer): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(bytes); // o Chrome reamostra para 16 kHz
    if (buf.numberOfChannels === 1) return buf.getChannelData(0);
    const a = buf.getChannelData(0), b = buf.getChannelData(1);
    const mono = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) mono[i] = (a[i] + b[i]) / 2;
    return mono;
  } finally {
    await ctx.close();
  }
}
```

- OGG/Opus, MP3, AAC, WAV e WebM são decodificados nativamente pelo Chrome.
- Se `decodeAudioData` falhar (ex.: AMR), mostrar `AUDIO_UNSUPPORTED_FORMAT`. Converter com ffmpeg.wasm fica para depois do MVP.
- O `Float32Array` vai para o Web Worker como objeto transferível (`postMessage(audio, [audio.buffer])`), sem cópia.

**Pontos a validar na Fase 0**

- Domínio real dos arquivos de áudio do WhatsApp no Agent Workspace (pode ser do Zendesk, de um CDN de anexos ou da plataforma de mensagens).
- Se esse URL exige a sessão do agente e se o Chrome envia os cookies na chamada do service worker.
- Se o player usa `src` direto ou `blob:`.

## 7. Motor de transcrição

O MVP usa o Whisper via Transformers.js (`@huggingface/transformers` v3), rodando na GPU do agente com WebGPU e na CPU com WASM quando não houver GPU. O modelo padrão sai do teste da Fase 1.

**Modelos candidatos**

| Modelo (ID na Hugging Face) | Uso | Download aproximado | Observação |
| --- | --- | --- | --- |
| `onnx-community/whisper-base` | Reserva para máquinas sem GPU (WASM) | \~0,1 GB | Rápido, qualidade menor em PT-BR |
| `onnx-community/whisper-small` | Candidato a padrão com WebGPU | \~0,3 a 0,5 GB | Bom equilíbrio para áudios curtos |
| `onnx-community/whisper-large-v3-turbo` | Opção "alta qualidade" para GPUs boas | \~0,8 a 1,5 GB, conforme quantização | Melhor PT-BR, mais pesado |

Os tamanhos são estimativas e devem ser medidos na Fase 1. Confirmar também que cada ID existe e tem pesos ONNX para WebGPU antes de fixá-lo no código. Os modelos NVIDIA Parakeet e Canary ficam fora do MVP: o Transformers.js não os suporta oficialmente e foram treinados com foco em idiomas europeus.

**Escolha do backend**

1. Se `navigator.gpu` existir e `requestAdapter()` retornar um adaptador, usar `device: 'webgpu'`.
2. Se o adaptador tiver o recurso `shader-f16`, usar `dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' }`. Senão, `dtype: 'q8'`.
3. Sem WebGPU, usar `device: 'wasm'`, `dtype: 'q8'` e trocar para o modelo de reserva (`whisper-base`), avisando na caixa: "Seu computador não tem aceleração de vídeo; usando modelo mais leve."

**Configuração do Transformers.js (no Web Worker)**

```ts
import { pipeline, env, WhisperTextStreamer, InterruptableStoppingCriteria } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true; // modelo fica no Cache Storage da extensão
env.remoteHost = settings.modelMirror ?? 'https://huggingface.co/';
// Manifest V3 proíbe código remoto: os .wasm do ONNX Runtime vão dentro do pacote
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('ort/');

const stopper = new InterruptableStoppingCriteria();
const asr = await pipeline('automatic-speech-recognition', modelId, {
  device, dtype,
  progress_callback: p => post({ type: 'MODEL_PROGRESS', ...p }),
});

const streamer = new WhisperTextStreamer(asr.tokenizer, {
  skip_prompt: true,
  callback_function: text => post({ type: 'PARTIAL', text }),
});

const out = await asr(audio16k, {
  language: settings.language,   // 'portuguese' ou null para detecção automática
  task: 'transcribe',
  chunk_length_s: 30,
  stride_length_s: 5,
  streamer,
  stopping_criteria: stopper,     // stopper.interrupt() no Cancelar
});
```

Nomes de classes e opções devem ser conferidos na documentação da versão instalada do Transformers.js; a API muda entre versões.

**Regras de execução**

- O pipeline é carregado uma vez e reaproveitado enquanto o offscreen document estiver aberto.
- Uma transcrição por vez. Pedidos novos entram numa fila (FIFO, no máximo 5). Pedido repetido para o mesmo `audioKey` reaproveita o que já está rodando.
- Cancelar chama `stopper.interrupt()`. Se em 3 s não parar, encerrar o Worker e recriá-lo.
- Aquecimento: ao carregar o modelo, rodar 1 s de silêncio para compilar os shaders da GPU, sem mostrar resultado.

**Pós-processamento do texto**

1. Remover alucinações conhecidas do Whisper em trechos de silêncio, comparando com uma lista configurável. Exemplos comuns em português: "Legendas pela comunidade Amara.org", "Obrigado por assistir", "Inscreva-se no canal".
2. Remover repetições da mesma frase em sequência (3 ou mais vezes).
3. Aplicar o dicionário de correções do cliente, sem diferenciar maiúsculas. Exemplo para a SKA: `edge cam` → `EDGECAM`, `solid works` → `SOLIDWORKS`, `drive works` → `DriveWorks`.
4. Se o resultado ficar vazio, mostrar "Não foi possível identificar fala neste áudio."

Usar o prompt inicial do Whisper com o vocabulário do cliente (melhora mais que o dicionário) fica para depois do MVP, após confirmar o suporte no Transformers.js.

## 8. Integração com a API do Zendesk

A extensão usa a API REST do Zendesk só para duas coisas: salvar a nota interna e verificar se um áudio já tem transcrição salva. As chamadas saem do content script, na mesma origem da página e com a sessão do agente.

**Autenticação**

- Sem token de API, OAuth ou senha. A requisição usa os cookies da sessão do agente (`credentials: 'same-origin'`).
- Requisições que alteram dados exigem o cabeçalho `X-CSRF-Token`. Ordem para obter o token:
  1. `GET /api/v2/users/me.json` e ler `user.authenticity_token`;
  2. reserva: `document.querySelector('meta[name="csrf-token"]')?.content`.
- Guardar o token em memória por ticket. Em resposta 401 ou 422 por token inválido, buscar de novo e repetir uma vez.
- Validar esse mecanismo na Fase 0: é o ponto técnico com mais incerteza desta seção.

**Salvar a nota interna**

```http
PUT /api/v2/tickets/{ticketId}.json
Content-Type: application/json
X-CSRF-Token: {token}

{ "ticket": { "comment": { "body": "{texto da nota, seção 3}", "public": false } } }
```

- `public: false` é obrigatório. Antes de enviar, o código deve conferir esse campo e abortar se não for `false`, para nunca mandar a transcrição ao cliente por engano.
- Usar `body` (texto puro), não `html_body`, para não interpretar conteúdo vindo do áudio.
- Após sucesso (200), o Agent Workspace mostra a nota sozinho. A extensão não precisa recarregar a página.
- Bloquear clique duplo: o botão fica desativado do clique até a resposta.
- Antes de salvar, verificar se já existe nota com o mesmo marcador `[atveza-transcricao:{audioKey}]`. Se existir, mostrar "Já salva neste ticket" e não duplicar.

**Efeitos colaterais que o agente precisa conhecer**

- Salvar a nota atualiza o ticket. Gatilhos e automações que dependem de "ticket atualizado" podem disparar. Recomendar ao administrador que gatilhos sensíveis ignorem notas com a tag ou o texto do marcador, se necessário.
- Se o agente tiver alterações não salvas no ticket (campos ou rascunho), o Zendesk pode avisar que o ticket foi atualizado. O rascunho não se perde, mas o agente verá o aviso.

**Verificar transcrições já salvas**

- Ao abrir um ticket que tenha pelo menos um áudio detectado, chamar `GET /api/v2/tickets/{ticketId}/comments.json?sort_order=desc&page[size]=100` uma vez.
- Procurar nas notas internas o padrão `\[atveza-transcricao:([a-f0-9]{32})\]` e guardar o texto encontrado como transcrição daquele `audioKey`.
- Ler no máximo 3 páginas. Esse resultado fica em memória até trocar de ticket.

**Erros da API**

| Código | Significado provável | Mensagem ao agente |
| --- | --- | --- |
| 401 | Sessão expirada | "Sua sessão do Zendesk expirou. Recarregue a página." |
| 403 | Agente sem permissão para notas internas | "Seu perfil não permite adicionar notas neste ticket." |
| 422 | Ticket fechado ou token inválido | "Não foi possível salvar. Tickets fechados não aceitam notas." |
| 429 | Limite de requisições | Esperar o tempo de `Retry-After` e tentar uma vez |
| 5xx | Instabilidade do Zendesk | "O Zendesk não respondeu. Tente de novo em instantes." |

## 9. Armazenamento, cache e configurações

A extensão guarda três coisas no computador do agente: o modelo, as transcrições recentes e as configurações. Nunca guarda o áudio.

**O que é guardado e onde**

| Dado | Onde | Validade | Limite |
| --- | --- | --- | --- |
| Arquivos do modelo | Cache Storage da extensão (gerenciado pelo Transformers.js) | Até trocar de modelo ou limpar pelo botão nas opções | Tamanho do modelo |
| Transcrições | `chrome.storage.local`, chave `tx:{audioKey}` | 30 dias | 500 itens; ao passar, apagar os mais antigos |
| Configurações do usuário | `chrome.storage.sync` | Permanente | Limite do Chrome (100 KB) |
| Configuração de seletores remota | `chrome.storage.local`, chave `selectors` | Até a próxima versão válida | Um arquivo |
| Token CSRF, lista de notas do ticket | Memória do content script | Até trocar de ticket | Um ticket |

**Formato de uma transcrição no cache**

```ts
interface CachedTranscript {
  audioKey: string;        // seção 6
  subdomain: string;       // ex.: 'skasuporte'
  ticketId: number;
  text: string;            // já pós-processado
  model: string;           // ex.: 'onnx-community/whisper-small'
  device: 'webgpu' | 'wasm';
  language: string | null; // detectado ou configurado
  audioSeconds: number;
  elapsedMs: number;       // tempo de transcrição
  createdAt: string;       // ISO 8601
  savedAsNote: boolean;
}
```

**Configurações (página de opções)**

| Configuração | Chave | Padrão | Valores |
| --- | --- | --- | --- |
| Modelo | `model` | definido na Fase 1 | os modelos da seção 7 |
| Idioma | `language` | `portuguese` | `portuguese`, `english`, `spanish`, `auto` |
| Mostrar o ⋯ nos áudios | `enabled` | `true` | sim / não |
| Transcrever ao abrir o ticket | `autoTranscribe` | `false` | sim / não (reservado, fora do MVP) |
| Salvar nota automaticamente ao concluir | `autoSaveNote` | `false` | sim / não |
| Dicionário de correções | `replacements` | vazio | lista de pares "de → para" |
| Frases a remover | `hallucinationFilters` | lista padrão (seção 7) | lista de textos |
| Espelho do modelo | `modelMirror` | vazio (usa huggingface.co) | URL HTTPS |
| URL da configuração de seletores | `selectorsUrl` | URL da ATVEZA | URL HTTPS |
| Subdomínios permitidos | `allowedSubdomains` | `['skasuporte', 'pdi-atveza']` | lista |
| Duração máxima do áudio | `maxAudioMinutes` | 10 | 1 a 30 |
| Modo descoberta | `discoveryMode` | `false` | sim / não |
| Logs detalhados no console | `debug` | `false` | sim / não |

**Ações na página de opções**

- "Baixar modelo agora": baixa antes do primeiro uso, mostrando o progresso.
- "Testar transcrição": transcreve um áudio de exemplo incluído no pacote e mostra tempo e backend usado.
- "Limpar transcrições" e "Remover modelo".
- "Copiar relatório de descoberta" (seção 5) e "Copiar diagnóstico" (versão, navegador, GPU, modelo, backend, últimos 20 erros, sem texto de transcrição).

Um administrador pode fixar configurações para toda a empresa com a política de extensões gerenciadas do Chrome (`chrome.storage.managed`, com `managed_schema.json`). Quando um valor vier dessa política, a opção aparece bloqueada para o agente.

## 10. Permissões, segurança e LGPD

A extensão pede o mínimo de permissões, não envia áudio nem texto para fora do Zendesk e não tem telemetria. Isso facilita a aprovação pelo TI do cliente e pela Chrome Web Store.

**Manifest (versão SKA)**

```json
{
  "manifest_version": 3,
  "name": "ATVEZA · Transcrever Áudio para Zendesk",
  "version": "0.1.0",
  "minimum_chrome_version": "124",
  "permissions": ["storage", "offscreen"],
  "host_permissions": [
    "https://skasuporte.zendesk.com/*",
    "https://pdi-atveza.zendesk.com/*",
    "https://huggingface.co/*",
    "https://*.huggingface.co/*",
    "https://*.hf.co/*",
    "https://<dominio-dos-anexos-descoberto-na-fase-0>/*",
    "https://raw.githubusercontent.com/*"
  ],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [{
    "matches": ["https://skasuporte.zendesk.com/agent/*", "https://pdi-atveza.zendesk.com/agent/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "options_page": "options.html",
  "storage": { "managed_schema": "managed_schema.json" },
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

- `wasm-unsafe-eval` é necessário para o ONNX Runtime (WebAssembly). É permitido no Manifest V3.
- A lista de subdomínios do Zendesk é gerada no build a partir de um arquivo `clients/<cliente>.json`. Para a versão de produto (vários clientes), usar `optional_host_permissions` com `https://*.zendesk.com/*` e pedir permissão por subdomínio na página de opções.
- O domínio da configuração remota (`raw.githubusercontent.com` no exemplo) deve ser trocado pelo domínio definitivo da ATVEZA.
- Sem `tabs`, `scripting`, `webRequest`, `cookies` ou `<all_urls>`.

**Regras de segurança do código**

1. Texto da transcrição é dado não confiável: inserir sempre com `textContent`, nunca com `innerHTML`.
2. Toda mensagem recebida via `chrome.runtime.onMessage` deve conferir `sender.id === chrome.runtime.id` e validar o formato com Zod.
3. Nada de `eval`, `new Function` ou script carregado de fora. Todo o JavaScript e os `.wasm` vão dentro do pacote.
4. Dependências com versão fixa (`package-lock.json` versionado) e `npm audit` sem vulnerabilidades altas antes de cada release.
5. A nota interna sempre com `public: false`, conferida em código antes do envio (seção 8).
6. Logs nunca incluem o texto transcrito nem dados de cliente, salvo com `debug` ligado, e mesmo assim só no console local.

**LGPD**

| Tema | Como a extensão trata |
| --- | --- |
| Onde o áudio é processado | Só no computador do agente. Não há envio a terceiros |
| O que sai da máquina | Apenas a nota interna, quando o agente pede (ou com `autoSaveNote`), para o próprio Zendesk do cliente |
| O que é baixado de fora | O modelo de IA (arquivos públicos) e o arquivo de seletores. Nenhum dado de cliente vai nessas chamadas |
| Retenção local | Transcrições por 30 dias, com botão para apagar. O áudio nunca é gravado |
| Telemetria | Nenhuma |
| Transparência | Rodapé da caixa e da nota informa que o texto foi gerado por IA e pode conter erros |

Entregar ao cliente, junto com a extensão, um texto curto para o encarregado de dados (DPO) com esta tabela e a política de privacidade publicada na página da Chrome Web Store.

## 11. Stack, estrutura de pastas e contratos de mensagens

TypeScript em modo estrito, empacotado com WXT (framework para extensões Manifest V3 baseado em Vite), interface em Preact dentro do Shadow DOM.

**Stack**

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Linguagem | TypeScript 5, `strict: true` | Contratos de mensagem tipados |
| Build da extensão | WXT (alternativa: Vite + `@crxjs/vite-plugin`) | Gera manifest, recarrega em desenvolvimento, empacota o zip |
| Interface | Preact + CSS dentro do Shadow DOM | Leve (cerca de 4 KB) e isolado do Zendesk |
| IA | `@huggingface/transformers` v3 (versão fixa) | Whisper com WebGPU e WASM no navegador |
| Validação | Zod | Mensagens, configurações e `selectors.json` |
| Testes unitários | Vitest + jsdom | Detecção, pós-processamento, cache |
| Testes ponta a ponta | Playwright com a extensão carregada | Fluxo completo numa página que imita o Zendesk |
| Qualidade | ESLint + Prettier | Padrão de código |

**Estrutura de pastas**

```
atveza-audio-transcriber/
├─ wxt.config.ts                 # manifest gerado a partir de clients/<cliente>.json
├─ clients/
│  ├─ ska.json                    # subdomínios, domínio dos anexos, dicionário
│  └─ dev.json                    # pdi-atveza
├─ entrypoints/
│  ├─ background.ts               # service worker: roteador, fetch, cache, offscreen
│  ├─ content/
│  │  ├─ index.ts                 # inicialização, navegação, observer
│  │  ├─ detector.ts              # estratégias da seção 5
│  │  ├─ injector.ts              # cria <atveza-audio-tools> com Shadow DOM
│  │  ├─ zendesk-api.ts           # CSRF, salvar nota, ler notas
│  │  └─ ui/
│  │     ├─ MoreButton.tsx
│  │     ├─ Menu.tsx
│  │     ├─ TranscriptPanel.tsx
│  │     └─ styles.css
│  ├─ offscreen/
│  │  ├─ index.html
│  │  ├─ main.ts                  # recebe pedidos, decodifica, fala com o worker
│  │  └─ whisper.worker.ts        # Transformers.js
│  └─ options/
│     ├─ index.html
│     └─ App.tsx
├─ src/shared/
│  ├─ messages.ts                 # tipos + esquemas Zod (abaixo)
│  ├─ settings.ts                 # padrões + leitura de sync e managed
│  ├─ selectors.default.json
│  ├─ audio-key.ts
│  ├─ postprocess.ts              # filtros e dicionário
│  └─ errors.ts                   # códigos da seção 12
├─ public/
│  ├─ ort/                        # .wasm do ONNX Runtime, copiados no build
│  ├─ samples/teste-ptbr.ogg      # áudio de teste da página de opções
│  └─ icons/
├─ managed_schema.json
├─ tests/
│  ├─ unit/
│  ├─ fixtures/zendesk-ticket.html  # cópia anonimizada da estrutura real (Fase 0)
│  └─ e2e/
└─ README.md
```

**Contratos de mensagens (`src/shared/messages.ts`)**

```ts
// content script -> service worker
type ToBackground =
  | { type: 'TRANSCRIBE'; requestId: string; audioKey: string; ticketId: number;
      subdomain: string; src?: string; base64?: string; mime?: string }
  | { type: 'CANCEL'; requestId: string }
  | { type: 'GET_CACHED'; audioKeys: string[] }
  | { type: 'MARK_SAVED'; audioKey: string }
  | { type: 'GET_SELECTORS' };

// service worker -> offscreen document
type ToOffscreen =
  | { type: 'OFF_TRANSCRIBE'; requestId: string; base64: string; mime?: string;
      model: string; language: string | null }
  | { type: 'OFF_CANCEL'; requestId: string };

// offscreen -> service worker -> content script (aba de origem, via chrome.tabs.sendMessage)
type Progress =
  | { type: 'MODEL_PROGRESS'; requestId: string; loadedBytes: number; totalBytes: number }
  | { type: 'STAGE'; requestId: string; stage: 'loading-model' | 'decoding' | 'transcribing' }
  | { type: 'PARTIAL'; requestId: string; text: string }
  | { type: 'DONE'; requestId: string; result: CachedTranscript }
  | { type: 'ERROR'; requestId: string; code: ErrorCode; detail?: string };
```

- O service worker guarda `requestId → tabId` para devolver o progresso à aba certa.
- `PARTIAL` traz o texto acumulado até o momento, não só o trecho novo. Isso simplifica a interface e tolera mensagens perdidas.
- Enviar `PARTIAL` no máximo a cada 150 ms para não sobrecarregar as mensagens.
- Como o service worker pode ser encerrado, o estado de cada pedido fica também em `chrome.storage.session` para retomada.

## 12. Tratamento de erros e alternativas

Todo erro vira um código fixo e uma mensagem curta em português, com uma ação clara para o agente. A extensão nunca quebra a página do Zendesk: qualquer exceção no content script é capturada e registrada.

| Código | Quando acontece | Mensagem ao agente | Comportamento |
| --- | --- | --- | --- |
| `AUDIO_FETCH_FAILED` | Nenhuma das tentativas de download funcionou | "Não consegui acessar este áudio. Recarregue o ticket e tente de novo." | Tentar de novo |
| `AUDIO_TOO_LONG` | Áudio acima do limite configurado | "Áudio longo demais para transcrever aqui (máx. {n} min)." | Sem nova tentativa |
| `AUDIO_UNSUPPORTED_FORMAT` | Navegador não decodifica o formato | "Formato de áudio não suportado ({mime})." | Sem nova tentativa |
| `MODEL_DOWNLOAD_FAILED` | Falha de rede ou bloqueio no download do modelo | "Não consegui baixar o modelo de IA. Verifique a internet ou fale com o TI (domínio huggingface.co)." | Tentar de novo; continua de onde parou se o cache permitir |
| `STORAGE_QUOTA` | Sem espaço para guardar o modelo | "Sem espaço no navegador para o modelo. Libere espaço ou escolha um modelo menor." | Link para opções |
| `GPU_LOST` | A GPU foi perdida durante a inferência | Nenhuma: troca para WASM e repete uma vez | Se falhar de novo, `TRANSCRIBE_FAILED` |
| `TRANSCRIBE_FAILED` | Erro genérico na inferência | "A transcrição falhou. Tente de novo." | Tentar de novo; detalhes no diagnóstico |
| `NO_SPEECH` | Resultado vazio após os filtros | "Não foi possível identificar fala neste áudio." | Fechar |
| `CANCELLED` | Agente cancelou | Nenhuma (caixa fecha) | — |
| `QUEUE_FULL` | Mais de 5 pedidos na fila | "Aguarde as transcrições em andamento." | — |
| `NOTE_SAVE_FAILED` | Erro da API ao salvar (seção 8) | Mensagem conforme o código HTTP | Tentar de novo, exceto 403 e 422 |
| `SELECTORS_INVALID` | Config remota não passou na validação | Nenhuma ao agente | Mantém a última válida e registra |
| `EXTENSION_UPDATED` | A extensão foi atualizada com a aba aberta | "A extensão foi atualizada. Recarregue a página." | Detectar `chrome.runtime.id` indefinido |

**Alternativas quando a página muda**

1. Se a configuração de seletores não achar áudio, mas existir `<audio>` na página, a extensão usa a estratégia 1 da seção 5 e coloca o ⋯ no canto do balão.
2. Se nem isso funcionar e houver links de áudio, aparece um botão flutuante discreto no canto inferior direito da conversa: "Áudios do ticket (n)". Ele abre a lista de áudios com "Transcrever" em cada um.
3. Se o ID do ticket não for encontrado, a extensão não mostra nada e registra `TICKET_ID_NOT_FOUND` no diagnóstico.
4. Após 3 tickets seguidos com áudio visível e nenhum detectado, o diagnóstico marca "seletores desatualizados". Esse é o sinal para atualizar o `selectors.json`.

## 13. Testes e critérios de aceite

O MVP só é entregue à SKA quando todos os critérios abaixo passarem na pdi-atveza e num piloto com 2 agentes da SKA.

**Testes automatizados**

| Tipo | O que cobre | Ferramenta |
| --- | --- | --- |
| Unitário | `detector.ts` contra a fixture anonimizada do Zendesk e contra variações (sem botão de download, só link, só rótulo) | Vitest + jsdom |
| Unitário | `audio-key.ts`, `postprocess.ts` (filtros, repetições, dicionário), validação Zod de mensagens e `selectors.json` | Vitest |
| Unitário | `zendesk-api.ts` com respostas simuladas (200, 401, 403, 422, 429) e a trava de `public: false` | Vitest |
| Ponta a ponta | Extensão carregada no Chromium, fixture servida localmente, clique no ⋯, transcrição real de `teste-ptbr.ogg` com `whisper-base` em WASM | Playwright |
| Ponta a ponta | SPA: trocar de ticket sem recarregar, conversa que carrega mais mensagens ao rolar, nenhum botão duplicado | Playwright |

**Conjunto de áudios de teste**

Montar 20 áudios reais de WhatsApp com autorização da SKA (ou gravados pela equipe), cobrindo: 5 s a 3 min, fala rápida, ruído de fábrica, sotaques do Sul, termos técnicos (EDGECAM, SOLIDWORKS, pós-processador, licença, dongle) e um áudio só com silêncio. Guardar a transcrição correta de cada um para comparar modelos na Fase 1.

**Critérios de aceite**

- [ ] O ⋯ aparece em 100% dos áudios de WhatsApp visíveis, em tickets abertos direto pela URL e por navegação interna.
- [ ] Nenhum botão duplicado depois de trocar 20 vezes entre tickets.
- [ ] O layout do player e da conversa não muda com a extensão ligada (comparação visual por captura de tela).
- [ ] Transcrição de um áudio de 60 s em até 15 s numa máquina com GPU integrada recente, com o modelo já baixado.
- [ ] Primeira palavra visível em até 5 s com o modelo já baixado.
- [ ] Em máquina sem WebGPU, a transcrição funciona em WASM, com o aviso de modelo mais leve.
- [ ] Cancelar para a transcrição em até 3 s.
- [ ] Salvar como nota interna cria exatamente uma nota privada, com o marcador. A nota nunca fica pública.
- [ ] Ao reabrir o ticket, o ⋯ indica que existe transcrição e "Ver transcrição" abre na hora.
- [ ] A caixa funciona só com teclado (Tab, Enter, Esc) e o leitor de tela anuncia o botão e o status.
- [ ] Nenhuma requisição de rede leva áudio ou texto para fora do Zendesk (verificado no painel Network do DevTools).
- [ ] O áudio só com silêncio resulta em "Não foi possível identificar fala", não em frase inventada.
- [ ] Qualidade aprovada pelos 2 agentes do piloto: entendem o áudio sem ouvir em pelo menos 9 de 10 casos.
- [ ] Uso de memória do navegador volta ao normal até 11 minutos depois da última transcrição (offscreen fechado).

## 14. Distribuição, versionamento e manutenção

Publicar na Chrome Web Store como **não listada**, na conta de desenvolvedor da ATVEZA. A SKA instala pelo link ou, se usar Chrome gerenciado, o TI instala em todos os agentes de uma vez.

**Canais de instalação**

| Canal | Para quem | Como |
| --- | --- | --- |
| Modo desenvolvedor ("Carregar sem compactação") | Athos e testes na pdi-atveza | Pasta `.output/chrome-mv3` gerada pelo build |
| Chrome Web Store, não listada | Agentes da SKA no piloto | Link direto; atualizações automáticas |
| Política `ExtensionInstallForcelist` | Todos os agentes da SKA, se o Chrome for gerenciado | TI adiciona o ID da extensão no Google Admin ou na política do Windows |
| Microsoft Edge Add-ons | Agentes que usam Edge | Publicação separada, mesmo pacote |

Não distribuir o arquivo `.crx` fora da loja: Chrome no Windows e no macOS bloqueia extensões instaladas assim, a menos que haja política corporativa.

**Itens da página da loja**

- Nome, descrição curta, ícone 128 px, 1 a 5 capturas de tela.
- Política de privacidade publicada (ex.: consultor.cx/privacidade-transcricao), com o conteúdo da tabela LGPD da seção 10.
- Justificativa de cada permissão: `storage` (cache e configurações), `offscreen` (rodar a IA), cada host (Zendesk do cliente, modelo, anexos, configuração).
- Declaração de que não há código remoto.
- A revisão da loja pode levar de horas a alguns dias. Contar com isso no cronograma.

**Versionamento**

- Versão semântica: `MAJOR.MINOR.PATCH`. Correções de seletor não exigem nova versão, só novo `selectors.json` com `version` maior.
- `CHANGELOG.md` atualizado a cada release.
- Tag no Git por versão e zip gerado por `wxt zip` anexado à release.

**Checklist de release**

1. Testes unitários e ponta a ponta passando.
2. `npm audit` sem vulnerabilidades altas.
3. Teste manual na pdi-atveza: ticket de WhatsApp, ticket de e-mail com áudio, troca de tickets, nota interna.
4. Conferir no DevTools que nenhuma requisição leva áudio ou texto para fora.
5. Atualizar versão, changelog e publicar.

**Manutenção**

- Acompanhar o "What's new" mensal do Zendesk e as notas de versão do Agent Workspace.
- Quando o diagnóstico indicar "seletores desatualizados" ou um agente avisar que o ⋯ sumiu: rodar o modo descoberta, ajustar o `selectors.json` e publicar. Meta: correção em até 1 dia útil.
- Revisar a versão do Transformers.js e os modelos disponíveis a cada trimestre.

## 15. Plano de implementação e instruções para a IA

Construir em 5 fases. Cada fase só começa quando a anterior passa no seu critério de saída. As Fases 0 e 1 existem para eliminar as duas maiores incertezas (estrutura da página e desempenho do modelo) antes de escrever o produto.

1. **Fase 0: Descoberta**
   - Extensão mínima só com content script e modo descoberta (seção 5).
   - Rodar na pdi-atveza com tickets de WhatsApp (com áudio) e de e-mail (com anexo de áudio).
   - Responder: estrutura do player, seletores estáveis, domínio dos arquivos, se o `fetch` do service worker funciona com cookies, como obter o token CSRF.
   - Saída: `selectors.json` real, `tests/fixtures/zendesk-ticket.html` anonimizado, domínio dos anexos no manifest e um relatório curto com as respostas.
2. **Fase 1: Teste do motor**
   - Offscreen document + Worker com Transformers.js, acionados pela página de opções ("Testar transcrição").
   - Rodar os 20 áudios de teste (seção 13) com os 3 modelos, em WebGPU e WASM, em pelo menos 2 máquinas (uma com GPU dedicada ou recente, uma típica dos agentes).
   - Medir: tamanho do download, tempo de carga, tempo por áudio, taxa de erro de palavras (WER) contra as transcrições corretas.
   - Saída: tabela de resultados e modelo padrão escolhido.
3. **Fase 2: MVP completo**
   - Botão ⋯, menu, caixa com estados, cache, nota interna, opções, erros e alternativas.
   - Saída: todos os critérios de aceite da seção 13 passando na pdi-atveza, exceto os do piloto.
4. **Fase 3: Piloto na SKA**
   - 2 agentes, 2 semanas, via Chrome Web Store não listada.
   - Coletar: áudios onde a transcrição falhou, termos errados (para o dicionário), opinião sobre o botão e a caixa.
   - Saída: critério de qualidade (9 de 10) aprovado.
5. **Fase 4: Liberação**
   - Instalação para todos os agentes da SKA, documento para o DPO, treinamento rápido de 15 minutos.

**Instruções para a IA que vai programar (Codex ou Claude)**

Copie o bloco abaixo como primeira mensagem, junto com este documento exportado em Markdown.

```markdown
Você vai construir a extensão Chrome descrita na especificação anexa
("Transcrever Áudio para Zendesk"). A especificação é a fonte da verdade.

Regras obrigatórias:
1. Trabalhe fase por fase (seção 15). Comece pela Fase 0 e pare ao final de
   cada fase, mostrando o que foi feito e o que precisa ser validado por mim.
2. Manifest V3, TypeScript strict, WXT, Preact, Zod, Vitest, Playwright (seção 11).
   Use exatamente a estrutura de pastas e os contratos de mensagens da seção 11.
3. Nunca invente seletores do Zendesk no código. Todo seletor vem de
   selectors.json (seção 5). Se não souber um seletor, deixe-o vazio e diga.
4. Nenhum código remoto: os .wasm do ONNX Runtime vão em public/ort/ e
   env.backends.onnx.wasm.wasmPaths aponta para eles (seção 7).
5. Nenhum áudio ou texto sai do computador, exceto a nota interna para o
   Zendesk do próprio cliente. Nada de telemetria, analytics ou APIs de IA externas.
6. Nota interna sempre com public: false, conferido em código antes do envio.
7. Texto da transcrição só entra no DOM via textContent.
8. Toda mensagem entre componentes é validada com Zod e confere sender.id.
9. Antes de usar uma API do Transformers.js, confira na versão instalada
   (node_modules) que a classe e as opções existem. Se forem diferentes da
   especificação, adapte e avise.
10. Escreva os testes unitários junto com cada módulo. Ao final de cada fase,
    rode lint, testes e build, e mostre os resultados.
11. Interface e mensagens ao usuário em português do Brasil, como nas
    seções 3 e 12. Código, nomes e comentários em inglês.
12. Se algo na especificação for impossível ou ambíguo, pare e pergunte em
    vez de supor.

Comece agora pela Fase 0: crie o projeto WXT, o content script com modo
descoberta e a página de opções com "Copiar relatório de descoberta".
Depois me diga como carregar a extensão e o que testar na pdi-atveza.
```

**Perguntas em aberto (respondidas pela Fase 0)**

- [ ] Qual é o domínio dos arquivos de áudio do WhatsApp no Agent Workspace?
- [ ] O player usa `<audio src>` direto ou `blob:`?
- [ ] O token CSRF sai de `/api/v2/users/me.json` ou de outro lugar?
- [ ] Os agentes da SKA usam Chrome gerenciado pelo Google Workspace (para a instalação em massa)?
- [ ] A rede da SKA libera o download de huggingface.co, ou será preciso um espelho interno?
