# Seção para atveza.com/privacy/

Texto pronto para acrescentar à página https://atveza.com/privacy/, depois da seção "WhatsApp Proativo para Zendesk" e no mesmo formato. A política completa da extensão está em `docs/politica-de-privacidade.md`.

---

## Transcrever Áudio para Zendesk

Aviso específico da extensão do Chrome · versão 0.2.0 · 19 de novembro de 2026

A extensão "ATVEZA · Transcrever Áudio para Zendesk" transcreve em texto os áudios de WhatsApp recebidos nos tickets do Zendesk. A transcrição é feita por um modelo de IA (Whisper) que roda no navegador do agente: **o áudio não é enviado para a ATVEZA nem para terceiros**, e nunca é gravado em disco.

O texto só sai do computador quando o agente pede para salvá-lo como **nota interna privada** no ticket, no Zendesk da própria empresa, usando a sessão já aberta do agente. A extensão nunca pede nem guarda senhas ou tokens.

No navegador do agente ficam guardados os arquivos do modelo de IA (baixados uma vez de huggingface.co ou de um espelho definido pela empresa), as transcrições recentes por até 30 dias (máximo de 500, sem o áudio), os códigos dos últimos erros (sem texto) e as configurações da extensão. O agente pode apagar as transcrições e o modelo nas opções da extensão; desinstalar a extensão apaga tudo.

A extensão não tem telemetria nem analytics e não envia dados para a ATVEZA. O texto é gerado por IA e pode conter erros; a extensão avisa isso na tela e na nota.

Para dúvidas sobre a extensão, escreva para athos@atveza.com. Para solicitações sobre os dados dos atendimentos, procure também a empresa responsável pela conta Zendesk.
