---
name: "adr-1687-webhook-evolution-por-canal"
description: "Webhook Evolution autenticado por segredo próprio de cada canal, com canal no caminho e idempotência escopada"
alwaysApply: false
---

# ADR-1687 — Webhook Evolution por canal

## Estado

Aceito para implementação em E02-S36.

## Contexto

`pcm-whatsapp-webhook` (E01/E02 legado) valida um **token global** (`EVOLUTION_WEBHOOK_TOKEN`) numa
rota fixa, e resolve a instância pelo **corpo** do evento (`payload.instance`). Quem conhece o token
de um número escreve PII na conversa de qualquer outro; um evento forjado escolhe a instância.
Achado em `docs/planejamento/port-evolution-triviatende.md` (c.1/c.2).

## Decisão

- Rota nova `POST /functions/v1/atendimento-evolution-webhook/{canalId}` — o canal vem do
  **caminho**, nunca do corpo.
- Segredo **próprio de cada canal**, gerado pelo produto em E02-S35 (`instalar_webhook`), comparado
  em **tempo constante**, **antes** de ler o corpo.
- Idempotência escopada em `(canal_id, event_type, remote_message_id)` — `atendimento.
  evolution_inbox`. Dois canais podem, em tese, receber o mesmo id remoto da Evolution sem colidir.
- Instância declarada no corpo é conferida contra o canal resolvido pela rota; divergência é
  recusada (`409`), nunca corrigida silenciosamente.
- Classificador total: nenhum tipo de mensagem desconhecido vira texto por omissão.
- Mensagem do aparelho (`fromMe`) continua pelo caminho legado (`fn_registrar_mensagem_celular`) —
  tirar o Zé é escopo de E02-S39, não desta ADR.
- O endpoint legado `pcm-whatsapp-webhook` **continua ativo** durante a transição; cada canal migra
  ao reinstalar o webhook.

## Consequências

- `atendimento.mensagens.wa_message_id` deixa de ter unicidade **global**: vira
  `(canal_id, wa_message_id)` para linha com canal, preservando a global só para linha legada sem
  canal (Meta WA ainda não migrado).
- Mídia, citação, reação e aviso são **reconhecidos** pelo classificador nesta story, mas só
  respondem `200 { ignorado }` — persistência é E02-S37/S38.
- Remover `pcm-whatsapp-webhook` e `EVOLUTION_WEBHOOK_TOKEN` só depois de **todo** canal migrado —
  story própria, fora deste ADR.

## Alternativas descartadas

**Manter resolução pelo corpo, só trocar o token por canal.** Não resolve o problema real: o
atacante ainda escolheria a instância informando outro `payload.instance` com um token roubado de
canal diferente. O canal precisa vir de algo que o atacante não controla — a rota.
