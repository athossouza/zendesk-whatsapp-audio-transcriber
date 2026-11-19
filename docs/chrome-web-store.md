# Chrome Web Store · ficha da extensão (piloto SKA)

Tudo o que o formulário da loja pede, pronto para copiar. Publicar como **não listada**, na conta de desenvolvedor da ATVEZA.

## Pacote

- Gerar: `npm run zip:ska` → `.output-ska/zendesk-whatsapp-audio-transcriber-ska-<versão>-chrome.zip` (cerca de 7 MB).
- Cada nova versão precisa de `version` maior no `package.json`. Correções de seletor não precisam de nova versão (seção 14 da especificação).

## Ficha

| Campo                       | Valor                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Nome                        | ATVEZA · Transcrever Áudio para Zendesk                                                                         |
| Resumo (até 132 caracteres) | Transcreve os áudios de WhatsApp dos tickets do Zendesk direto no seu computador, sem enviar o áudio para fora. |
| Categoria                   | Produtividade → Fluxo de trabalho e planejamento                                                                |
| Idioma                      | Português (Brasil)                                                                                              |
| Visibilidade                | Não listada                                                                                                     |
| Ícone                       | `public/icons/128.png`                                                                                          |
| Capturas de tela            | 1280 × 800 px, de 1 a 5 (ver `docs/store-assets/`)                                                              |
| Política de privacidade     | URL pública com o conteúdo de `docs/politica-de-privacidade.md` (ex.: consultor.cx/privacidade-transcricao)     |

### Descrição

> Seus clientes mandam áudios pelo WhatsApp e você precisa ouvir cada um? Com esta extensão, você lê o áudio em segundos, sem sair do ticket.
>
> • Clique no ⋯ ao lado do áudio e escolha "Transcrever".
> • O texto aparece enquanto é gerado, numa caixa ao lado do áudio.
> • Copie o texto ou salve como nota interna (privada) no ticket, com um clique.
>
> Privacidade: a transcrição é feita por um modelo de IA (Whisper) que roda no seu próprio navegador. O áudio não é enviado para a ATVEZA nem para nenhum serviço externo. Sem telemetria.
>
> Na primeira vez, o modelo de IA é baixado e fica guardado no navegador. Funciona melhor em computadores com placa de vídeo compatível com WebGPU; sem ela, usa um modelo mais leve no processador.
>
> Extensão para empresas clientes da ATVEZA. Funciona apenas nos endereços do Zendesk configurados para a sua empresa.

## Finalidade única (single purpose)

> Transcrever em texto, no computador do agente, os áudios recebidos nos tickets do Zendesk, e permitir salvar o texto como nota interna do ticket.

## Justificativa das permissões

| Permissão                                                                     | Justificativa para a revisão                                                                                                                                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                                                     | Guardar as configurações do usuário, as transcrições recentes (para não transcrever o mesmo áudio de novo) e a configuração definida pelo administrador.                   |
| `offscreen`                                                                   | Rodar o modelo de IA num documento offscreen com Web Worker e Web Audio, que o service worker não oferece. A transcrição é longa demais para o service worker.             |
| `https://skasuporte.zendesk.com/*`, `https://pdi-atveza.zendesk.com/*`        | Mostrar o botão de transcrição nos áudios dos tickets e salvar a nota interna pela API do Zendesk, usando a sessão do agente.                                              |
| `https://huggingface.co/*`, `https://*.huggingface.co/*`, `https://*.hf.co/*` | Baixar uma única vez os arquivos públicos do modelo de IA (Whisper). A Hugging Face redireciona os downloads para os domínios `*.hf.co`. Nenhum dado do usuário é enviado. |

## Código remoto

**Não.** Todo o JavaScript e o WebAssembly (ONNX Runtime) estão dentro do pacote. Do Hugging Face vêm apenas os **pesos do modelo** (arquivos de dados `.onnx` e `.json`), não código.

Se a revisão perguntar, explicar também:

- O texto `cdn.jsdelivr.net` aparece no código do Transformers.js como endereço padrão do ONNX Runtime. A extensão substitui esse endereço pela pasta `ort/` do pacote antes de qualquer uso, e nenhum arquivo é baixado do jsdelivr.
- A biblioteca Zod contém uma rotina que usa `new Function`. Ela está desligada (`jitless`), e a extensão nunca a executa.
- `wasm-unsafe-eval` na CSP é exigido para executar o WebAssembly do ONNX Runtime, que está no pacote. É permitido no Manifest V3.

## Uso de dados (formulário "Privacidade")

Recomendação: declarar que a extensão **não coleta** dados do usuário, porque nada é transmitido para a ATVEZA nem para terceiros. A nota interna é enviada, por ação do usuário, ao serviço que ele já está usando (o Zendesk da própria empresa).

Se a revisão exigir uma declaração mais conservadora, marcar **"Conteúdo do site"** (áudio e mensagens do ticket), com o uso "funcionalidade da extensão", sem venda, sem uso para crédito e sem transferência a terceiros.

Marcar também as três certificações: não vende dados, não usa para fins não relacionados à finalidade única, não usa para crédito.

## Antes de enviar

- [ ] Política de privacidade publicada numa URL pública, com o e-mail de contato confirmado.
- [ ] Capturas de tela aprovadas (sem dados de clientes reais).
- [ ] `npm run check` e `npm run test:e2e` passando.
- [ ] Teste manual da versão SKA em pdi-atveza (carregar `.output-ska/chrome-mv3` sem compactação).
- [ ] Revisão da loja leva de horas a alguns dias: contar com isso no cronograma.
