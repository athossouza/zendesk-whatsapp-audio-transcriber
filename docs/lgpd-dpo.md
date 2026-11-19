# Nota para o encarregado de dados (DPO) · SKA

**Assunto:** extensão "Transcrever Áudio para Zendesk", usada pelos agentes de suporte da SKA
**De:** ATVEZA · **Data:** 19/11/2026

## O que é

Uma extensão do Google Chrome que transcreve em texto os áudios de WhatsApp recebidos nos tickets do Zendesk da SKA. O agente clica no áudio, lê o texto e, se quiser, salva o texto como **nota interna** (privada) no próprio ticket.

## Como os dados pessoais são tratados

| Tema                      | Como a extensão trata                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Onde o áudio é processado | Só no computador do agente, por um modelo de IA que roda no navegador. Não há envio a terceiros                                                                                                                    |
| O que sai da máquina      | Apenas a nota interna, quando o agente pede, para o Zendesk da própria SKA (skasuporte.zendesk.com)                                                                                                                |
| O que é baixado de fora   | O modelo de IA (arquivos públicos da Hugging Face) e nada mais. Nenhum dado de cliente vai nessas chamadas                                                                                                         |
| Retenção local            | Transcrições por até 30 dias (máximo 500) no navegador do agente, com botão para apagar. O áudio nunca é gravado                                                                                                   |
| Telemetria                | Nenhuma                                                                                                                                                                                                            |
| Operador / terceiros      | Não há operador adicional. A ATVEZA não recebe dados                                                                                                                                                               |
| Transparência             | A caixa de transcrição e a nota informam que o texto foi gerado por IA e pode conter erros                                                                                                                         |
| Base legal sugerida       | A mesma que já cobre o atendimento por WhatsApp no Zendesk (execução de contrato / legítimo interesse no suporte). A extensão não cria uma nova finalidade: transforma em texto um dado que o agente já pode ouvir |

## Controles disponíveis para a SKA

- **Política do Chrome (TI):** fixar o modelo, o idioma, os subdomínios permitidos, desligar o salvamento automático de notas etc. (`managed_schema.json`).
- **Espelho interno do modelo:** se a SKA não quiser downloads de huggingface.co, o TI pode hospedar os arquivos do modelo internamente.
- **Apagar dados locais:** cada agente pode apagar transcrições e modelo nas opções da extensão. Desinstalar a extensão apaga tudo.

## Pontos para a SKA decidir

1. Se as notas internas com transcrição devem seguir a mesma política de retenção dos tickets (hoje seguem, porque ficam no Zendesk).
2. Se o salvamento automático de notas pode ser ligado (hoje vem desligado).
3. A coleta dos 20 áudios reais para o teste de qualidade do piloto precisa de autorização: usar áudios da própria equipe ou de clientes que concordaram.

Política de privacidade completa: `docs/politica-de-privacidade.md` (a ser publicada no site da ATVEZA).
