# Fase 0 · Relatório de descoberta

Data: 2026-11-19 · Ambiente: `d3v-atveza.zendesk.com`, ticket 454 (WhatsApp, 3 áudios) · Chrome desktop.

## Respostas às perguntas da especificação

| Pergunta (seções 6, 8 e 15)                              | Resposta                                                                                                                                                                                                                                                                                     | Impacto                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Estrutura do player                                      | Componente próprio do Zendesk com `data-test-id` estáveis: `audio-player-container` (com `role="region"`, `aria-label="Reprodutor de áudio"`), `audio-player-title`, `audio-player-play-button`, `audio-player-time`, `audio-player-waveform`, `audio-player-speed`, `audio-player-download` | Estratégias 1 e 2 da seção 5 funcionam com estabilidade alta                                                                                  |
| O player usa `src` direto ou `blob:`?                    | **`blob:`** (`blob:https://<sub>.zendesk.com/<uuid>`), `preload="metadata"`                                                                                                                                                                                                                  | O service worker não consegue ler o áudio. O download tem de sair do content script (passo 2 da seção 6), que lê o `blob:` da própria página  |
| Domínio dos arquivos                                     | O Zendesk monta o `blob:` a partir de `https://<sub>.zendesk.com/api/v2/ticket_attachments/<ULID>/content`, no próprio domínio do cliente                                                                                                                                                    | **Nenhum domínio de anexos extra no manifest.** O item `<dominio-dos-anexos-descoberto-na-fase-0>` da seção 10 sai                            |
| O `fetch` do `blob:` funciona?                           | Sim, no contexto da página: `200`, `audio/ogg`, ~17 KB para 6 s                                                                                                                                                                                                                              | Falta confirmar no contexto do content script: o modo descoberta da extensão já mede isso (campo `fetchProbe`)                                |
| O áudio aparece em `/api/v2/tickets/{id}/comments.json`? | **Não.** Os 3 comentários do ticket vêm sem `attachments`; o áudio de mensagens fica na plataforma de conversas                                                                                                                                                                              | O `audioKey` não pode usar a URL (o `blob:` muda a cada carga). Usar a regra "sem URL" da seção 6: `ticketId + horário da mensagem + duração` |
| Token CSRF                                               | `meta[name="csrf-token"]` existe na página; `GET /api/v2/users/me.json` responde com a sessão do agente                                                                                                                                                                                      | Os dois caminhos da seção 8 estão disponíveis. Validar a gravação real da nota na Fase 2                                                      |
| Troca de ticket sem recarregar                           | `window.navigation` (Navigation API) disponível                                                                                                                                                                                                                                              | Detecção por evento + verificação de `location.pathname` a cada 1 s, como na seção 5                                                          |

## Estrutura encontrada

```
section #omni-log-container  role=feed                  ← raiz da conversa
  article #omni-log-comment-item  aria-label="Mensagem de <nome>, por WhatsApp, há <tempo>"
    h4 > div #omni-log-item-sender                      ← autor
    time #timestamp-absolute  datetime=<ISO 8601>       ← horário
    div #omni-log-omni-to-ag-comment
      div #omni-log-item-message  type=end-user|agent   ← cliente ou agente
        div #audio-player-container  role=region        ← player
          audio[src=blob:…]
          div #audio-player-title  "Gravação de WhatsApp"
          button #audio-player-play-button
          span #audio-player-time  "0:00 / 0:06"
          div #audio-player-waveform  role=slider
          button #audio-player-speed
          button #audio-player-download                 ← o ⋯ entra logo depois deste
```

Os valores reais estão em [`src/shared/selectors.default.json`](../src/shared/selectors.default.json), e a cópia anonimizada em [`tests/fixtures/zendesk-ticket.html`](../tests/fixtures/zendesk-ticket.html).

## Mudanças em relação à especificação

1. **Domínio dos anexos:** não há. O manifest só pede os subdomínios do Zendesk.
2. **`audioKey`:** como o `src` é `blob:`, a chave usa `subdomínio + ticketId + datetime da mensagem + duração + posição do áudio na mensagem`. Proponho incluir a posição para o caso raro de dois áudios na mesma mensagem.
3. **Download:** o caminho principal passa a ser o content script lendo o `blob:` (o service worker fica só como reserva para links `https` de anexos de e-mail).
4. **Ambiente de testes:** `d3v-atveza` foi adicionado aos subdomínios do build `dev` (`clients/dev.json`), junto com `pdi-atveza`.
5. **Versões:** o Transformers.js já está na v4 (a especificação cita a v3). A Fase 1 confere a API na versão instalada, como pede a regra 9.

## O que ainda falta validar com a extensão carregada

- [ ] Carregar a extensão, ligar o modo descoberta, abrir o ticket 454 e conferir no relatório que `fetchProbe.ok` é `true` (content script lendo o `blob:`).
- [ ] Repetir num ticket de e-mail com anexo de áudio (não havia nenhum no ambiente na hora do teste).
- [ ] Trocar de ticket sem recarregar e conferir que nenhum áudio é registrado duas vezes.

## Perguntas que só a SKA responde

- [ ] Os agentes usam Chrome gerenciado pelo Google Workspace (instalação em massa)?
- [ ] A rede libera `huggingface.co`, ou será preciso um espelho interno?
