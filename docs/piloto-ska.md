# Piloto SKA (Fase 3)

**Objetivo:** confirmar, com agentes reais da SKA, que a transcrição permite entender o áudio sem ouvir em **pelo menos 9 de 10 casos** (seção 15 da especificação) e que a extensão é rápida o bastante nos computadores deles.

**Formato:** 2 agentes · 2 semanas · versão `0.2.0` (build `ska`).

## Checklist antes de começar

| #   | Item                                                                                                                        | Responsável  | Como                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------- |
| 1   | Escolher os 2 agentes do piloto (um com o computador mais modesto da equipe) e informar o e-mail da conta Google de cada um | SKA          | —                                                   |
| 2   | Rodar a bancada num computador típico de agente (ver abaixo)                                                                | SKA + ATVEZA | 20 min por máquina                                  |
| 3   | Confirmar que a rede libera `huggingface.co` e `*.hf.co`                                                                    | TI da SKA    | Abrir https://huggingface.co no navegador do agente |
| 4   | Juntar os 20 áudios de teste com as transcrições corretas (ver abaixo)                                                      | SKA          | Com autorização                                     |
| 5   | Aprovar o texto para o DPO                                                                                                  | DPO da SKA   | `docs/lgpd-dpo.md`                                  |
| 6   | Publicar a seção da extensão em atveza.com/privacy/                                                                         | ATVEZA       | `docs/privacidade-secao-site.md`                    |
| 7   | Publicar na Chrome Web Store como **privada**, com os 2 agentes como testadores confiáveis                                  | ATVEZA       | `docs/chrome-web-store.md`                          |
| 8   | Instalar nos 2 agentes e fazer o treinamento de 15 min                                                                      | ATVEZA       | Seção "Guia rápido do agente"                       |

Enquanto a loja não aprova, dá para começar com a instalação manual (modo desenvolvedor), descrita abaixo.

## Instalação

**Pela Chrome Web Store (recomendado):** o agente entra no Chrome com a conta Google cadastrada como testador, abre o link da extensão e clica em "Usar no Chrome". As atualizações chegam sozinhas.

**Manual (enquanto a loja não aprova):**

1. Receber o arquivo `zendesk-whatsapp-audio-transcriber-ska-0.2.0-chrome.zip` e descompactar numa pasta que não seja apagada.
2. Abrir `chrome://extensions`, ligar **Modo do desenvolvedor**, clicar em **Carregar sem compactação** e escolher a pasta.
3. Recarregar as abas do Zendesk.

> Na instalação manual, o Chrome pode mostrar um aviso de "extensões em modo desenvolvedor" ao abrir. É esperado.

**Primeiro uso:** em **Opções da extensão → Testar transcrição**, clicar em "Testar transcrição". Isso baixa o modelo (cerca de 566 MB, só uma vez) e confirma que tudo funciona.

## Bancada num computador de agente

Mede se o modelo padrão (whisper-large-v3-turbo) é rápido o bastante na máquina real.

1. Com a extensão instalada, abrir **Opções → Bancada de testes (Fase 1)**.
2. Marcar os modelos **Whisper small** e **Whisper large-v3-turbo**, e os dois processamentos.
3. Clicar em **Rodar** e esperar (o primeiro download leva alguns minutos).
4. Clicar em **Baixar CSV** e enviar o arquivo para a ATVEZA, junto com o **Copiar diagnóstico** das opções.

**Como decidir:**

| Resultado do turbo na máquina do agente               | Decisão                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| "Tempo p/ 60 s" até 15 s e "1ª palavra" até 5 s       | Manter o turbo como padrão                                                |
| Mais lento que isso, mas o small cumpre as metas      | Definir o small como padrão (por política do Chrome ou na opção "Modelo") |
| Nenhum cumpre (máquina sem placa de vídeo compatível) | Usar o small no processador e aceitar mais espera, ou rever o hardware    |

## Os 20 áudios de teste

Servem para medir a qualidade com números (WER), além da opinião dos agentes.

- **De onde:** áudios gravados pela própria equipe ou de clientes que autorizaram. Nada de áudio de cliente sem autorização (ver nota do DPO).
- **O que cobrir:** de 5 s a 3 min, fala rápida, ruído de fábrica, sotaques do Sul, termos técnicos (EDGECAM, SOLIDWORKS, DriveWorks, pós-processador, licença, dongle) e um áudio só com silêncio.
- **Formato:** o arquivo de áudio (o `.ogg` baixado do Zendesk serve) e um `.txt` **com o mesmo nome** contendo exatamente o que foi dito. Ex.: `licenca-edgecam.ogg` + `licenca-edgecam.txt`.
- **Como rodar:** na bancada, em "Áudios próprios", selecionar todos os `.ogg` e `.txt` juntos e clicar em **Rodar**.

## O que os agentes registram

Uma planilha simples, uma linha por áudio transcrito no dia a dia:

| Data | Ticket | Duração do áudio | Entendeu sem ouvir? (sim/não) | Erros importantes (palavras trocadas) | Salvou como nota? | Observações |
| ---- | ------ | ---------------- | ----------------------------- | ------------------------------------- | ----------------- | ----------- |

Os **termos errados recorrentes** viram entradas do dicionário de correções (ex.: "edge cam" → "EDGECAM"). O dicionário atual da SKA está em `clients/ska.json`.

Ao fim de cada semana, perguntar também:

1. O botão ⋯ apareceu em todos os áudios?
2. A caixa atrapalhou a leitura da conversa em algum momento?
3. Quanto tempo, em média, até aparecer o texto?
4. Usou "Salvar como nota interna"? Alguma nota saiu errada?

## Critério de saída do piloto

- [ ] Em pelo menos 9 de 10 áudios, os agentes entenderam sem ouvir.
- [ ] Nenhuma nota interna saiu pública.
- [ ] O tempo até o texto foi aceitável nos computadores dos agentes (ou o modelo padrão foi ajustado).
- [ ] Os termos técnicos recorrentes estão no dicionário.

## Suporte durante o piloto

- **O ⋯ sumiu ou algo deu erro:** recarregar a aba do Zendesk. Se continuar, em **Opções → Copiar diagnóstico**, colar numa mensagem para a ATVEZA. O diagnóstico não contém texto de transcrição nem dados de cliente.
- **Mensagem "A extensão foi atualizada. Recarregue a página.":** recarregar a aba.
- **Desligar no meio do piloto:** em Opções, desmarcar "Mostrar o ⋯ nos áudios", ou remover a extensão em `chrome://extensions`.

---

## Guia rápido do agente (para o treinamento de 15 min)

1. Abra um ticket com áudio de WhatsApp. Ao lado do ícone de download do áudio aparece o **⋯**.
2. Clique no **⋯ → Transcrever**. Na primeira vez do dia, pode levar alguns segundos a mais para carregar o modelo.
3. O texto aparece numa caixa junto do áudio. **Confira antes de usar**: é gerado por IA e pode ter erros, principalmente em nomes e termos técnicos.
4. Embaixo da caixa:
   - **Copiar** copia o texto;
   - **Transcrever de novo** refaz a transcrição;
   - **Salvar como nota interna** grava o texto como nota **privada** no ticket (o cliente não vê).
5. Um **pontinho azul** no ⋯ indica que o áudio já foi transcrito: **⋯ → Ver transcrição** abre na hora.
6. Se a caixa estiver atrapalhando (por exemplo, em cima do editor de resposta), **arraste pelo título** "Transcrição" para outro lugar. Para mudar o tamanho, **arraste o canto inferior direito**; o tamanho escolhido fica guardado. **Clique duplo no título** volta a caixa para perto do áudio. Enquanto a caixa está aberta, o áudio de origem fica com um **contorno azul**, e o título mostra quem enviou, a hora e a duração; o ícone de **mira** no título rola a conversa até o áudio.
7. Feche a caixa com **Esc** ou no **✕**.
