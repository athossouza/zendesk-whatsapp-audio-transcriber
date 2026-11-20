# Publicar na Chrome Web Store · passo a passo

O Chrome não deixa extensões nem navegadores automatizados mexerem nas páginas da Chrome Web Store, então o preenchimento é manual. Tudo abaixo está na ordem das telas do [painel de desenvolvedor](https://chrome.google.com/webstore/devconsole), com o texto exato de cada campo.

**Arquivos:** pasta `publicacao/` na raiz do projeto (gerada por `npm run store:assets`):

| Arquivo                                                   | Onde usar                         |
| --------------------------------------------------------- | --------------------------------- |
| `zendesk-whatsapp-audio-transcriber-ska-0.2.0-chrome.zip` | Novo item → enviar pacote         |
| `icone-128.png`                                           | Ficha → Ícone da loja             |
| `captura-1-transcricao.png`, `captura-2-menu.png`         | Ficha → Capturas de tela          |
| `promo-440x280.png`                                       | Ficha → Bloco promocional pequeno |

## 1. Conta (menu à esquerda → Conta)

- **Nome do editor:**

  ```text
  ATVEZA
  ```

- **E-mail de contato:** `athos@atveza.com` → clicar em verificar e abrir o link recebido por e-mail.
- **Contas de testadores confiáveis:** os e-mails Google dos 2 agentes do piloto, separados por vírgula (aguardando a SKA).
- Salvar.

## 2. Novo item

Itens → **+ Novo item** → enviar `zendesk-whatsapp-audio-transcriber-ska-0.2.0-chrome.zip`.

## 3. Ficha da loja (aba "Ficha da loja")

- **Descrição:**

  ```text
  Seus clientes mandam áudios pelo WhatsApp e você precisa ouvir cada um? Com esta extensão, você lê o áudio em segundos, sem sair do ticket.

  • Clique no ⋯ ao lado do áudio e escolha "Transcrever".
  • O texto aparece enquanto é gerado, numa caixa ao lado do áudio.
  • Copie o texto ou salve como nota interna (privada) no ticket, com um clique.

  Privacidade: a transcrição é feita por um modelo de IA (Whisper) que roda no seu próprio navegador. O áudio não é enviado para a ATVEZA nem para nenhum serviço externo. Sem telemetria.

  Na primeira vez, o modelo de IA é baixado e fica guardado no navegador. Funciona melhor em computadores com placa de vídeo compatível com WebGPU; sem ela, usa um modelo mais leve no processador.

  Extensão para empresas clientes da ATVEZA. Funciona apenas nos endereços do Zendesk configurados para a sua empresa.
  ```

- **Categoria:** Produtividade → Fluxo de trabalho e planejamento
- **Idioma:** Português (Brasil)
- **Ícone da loja:** `icone-128.png`
- **Capturas de tela:** `captura-1-transcricao.png` e `captura-2-menu.png`
- **Bloco promocional pequeno:** `promo-440x280.png`
- **Site oficial:** `https://consultor.cx`
- **Suporte:** `mailto:athos@atveza.com`
- Salvar rascunho.

> O resumo curto (até 132 caracteres) vem do campo `description` do pacote: "Transcreve áudios de WhatsApp no Zendesk, direto no seu computador."

## 4. Privacidade (aba "Práticas de privacidade")

- **Finalidade única:**

  ```text
  Transcrever em texto, no computador do agente, os áudios recebidos nos tickets do Zendesk, e permitir salvar o texto como nota interna do ticket.
  ```

- **Justificativa · storage:**

  ```text
  Guardar as configurações do usuário, as transcrições recentes (para não transcrever o mesmo áudio de novo) e a configuração definida pelo administrador da empresa.
  ```

- **Justificativa · offscreen:**

  ```text
  Rodar o modelo de IA (Whisper) num documento offscreen com Web Worker e Web Audio, recursos que o service worker não oferece. A transcrição é longa demais para o service worker.
  ```

- **Justificativa · permissões de host:**

  ```text
  skasuporte.zendesk.com e pdi-atveza.zendesk.com: mostrar o botão de transcrição nos áudios dos tickets e salvar a nota interna pela API do Zendesk, usando a sessão do agente. huggingface.co, *.huggingface.co e *.hf.co: baixar uma única vez os arquivos públicos do modelo de IA (pesos, não código); a Hugging Face redireciona os downloads para *.hf.co. Nenhum dado do usuário é enviado a esses domínios.
  ```

- **Você está usando código remoto?** Não.
- **Uso de dados:** não marcar nenhum tipo de dado coletado (nada é transmitido para a ATVEZA nem para terceiros). Se a revisão contestar, marcar "Conteúdo do site" (ver `docs/chrome-web-store.md`).
- **Certificações:** marcar as três (não vende dados, não usa para fins fora da finalidade única, não usa para crédito).
- **URL da política de privacidade:**

  ```text
  https://consultor.cx/politica-de-privacidade#transcrever-audio-zendesk
  ```

  Seção publicada e conferida em 19/11/2026.

## 5. Distribuição (aba "Distribuição")

- **Visibilidade:** Privada → "Apenas testadores confiáveis".
- **Regiões:** todas (ou só Brasil).

## 6. Enviar para revisão

Só depois de: seção de privacidade publicada no site, e-mail verificado e testadores cadastrados. A revisão leva de horas a alguns dias. Depois de aprovada, mandar o link da extensão para os agentes do piloto.
