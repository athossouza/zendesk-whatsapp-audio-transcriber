# Política de privacidade · Transcrever Áudio para Zendesk

Última atualização: 19 de novembro de 2026 · Responsável: ATVEZA SERVICOS EM TECNOLOGIA LTDA (ATVEZA Technology), CNPJ 48.761.773/0001-17

Esta política vale para a extensão do Chrome "ATVEZA · Transcrever Áudio para Zendesk" (a "extensão"). Publicação: como uma seção da página https://atveza.com/privacy/, no mesmo formato da seção do "WhatsApp Proativo para Zendesk" (texto pronto em `docs/privacidade-secao-site.md`).

## Resumo

- A transcrição é feita **no computador do agente**. O áudio não é enviado para a ATVEZA nem para nenhum serviço de terceiros.
- A extensão **não tem telemetria** nem analytics, e não coleta dados de uso.
- O único dado que sai do computador é a **nota interna**, e só quando o agente pede (ou quando a empresa liga o salvamento automático). Ela vai para o **próprio Zendesk da empresa**, como uma nota privada no ticket.

## O que a extensão acessa

| Dado                                              | Para quê                                   | Onde fica                                                                   |
| ------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| Áudio da conversa do ticket                       | Gerar a transcrição                        | Só na memória do navegador, durante a transcrição. Nunca é gravado em disco |
| Nome de quem enviou o áudio e horário da mensagem | Montar o cabeçalho da nota interna         | Na nota, no Zendesk da empresa                                              |
| Notas internas do ticket                          | Saber se um áudio já tem transcrição salva | Lidas da API do Zendesk com a sessão do agente; não são guardadas fora dele |
| Sessão do agente no Zendesk                       | Ler o ticket e salvar a nota               | A extensão usa a sessão já aberta; nunca pede nem guarda senha ou token     |

## O que fica guardado no computador do agente

| Dado                                                        | Por quanto tempo       | Como apagar                                                                          |
| ----------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| Arquivos do modelo de IA (Whisper), baixados uma vez        | Até remover            | Opções → "Remover modelos baixados"                                                  |
| Transcrições recentes (texto e dados técnicos, sem o áudio) | 30 dias, no máximo 500 | Opções → "Limpar transcrições"                                                       |
| Códigos dos últimos 20 erros (sem texto de transcrição)     | Até serem substituídos | Desinstalar a extensão                                                               |
| Configurações (modelo, idioma, dicionário de correções)     | Permanente             | Sincronizadas pela conta Google do navegador, como as demais configurações do Chrome |

## O que é baixado da internet

- O **modelo de IA** (arquivos públicos) de huggingface.co ou de um espelho interno definido pela empresa.
- Nenhum dado de cliente ou do agente vai junto nesses downloads.

## Compartilhamento

A ATVEZA não recebe, não vende e não compartilha dados de clientes ou agentes. A extensão não envia dados para a ATVEZA.

## Inteligência artificial

O texto é gerado automaticamente e pode conter erros. A caixa de transcrição e a nota interna avisam isso, e o agente deve conferir antes de usar.

## Contato

Dúvidas sobre a extensão ou sobre esta política: athos@atveza.com. Pedidos sobre seus dados pessoais em geral: contato@atveza.com. Para dados dos atendimentos, procure também a empresa responsável pela conta Zendesk.
