---
name: adr-0001-pcm-origin-truth-externalid
description: Decisão de PCM como origin of truth e externalId idempotente no Auvo. Puxe ao tocar integração Auvo ou criar OS.
alwaysApply: false
---

# ADR-0001 — PCM como origin of truth; externalId idempotente no Auvo

**Status:** Aceito
**Data:** 2026-06-25
**Decisores:** @architect, @pm
**Relacionados:** spec `0002-abertura-chamado-ze`, design.md, blueprint integracoes/auvo.md

## Contexto
O Auvo é o app de campo dos técnicos: tudo que acontece na execução (GPS, fotos, checklist,
assinatura) vive lá. Mas o Auvo também pode criar tasks diretamente — criando risco de duas fontes
de verdade para a mesma OS. Precisamos definir claramente quem decide e quem executa.

Além disso, ao reenviar uma OS ao Auvo (retry, reconciliação), sem mecanismo de idempotência o
Auvo cria task duplicada, gerando dois chamados para o mesmo técnico.

Esta decisão afeta todo o ciclo de vida de OS e a integração Auvo — custosa de reverter.

## Decisão
1. **PCM é o origin of truth** para decisões: criação, atribuição, prioridade, cancelamento.
   O Auvo é o origin of truth para **execução** (GPS, fotos, checklist, assinatura, peças).
2. Toda task criada no Auvo pelo PCM é enviada com `externalId = <id_da_os_no_pcm>`.
   O Auvo garante unicidade por `externalId` — reenviar não duplica.
3. O Auvo retorna seu próprio `taskId` → persiste em `pcm.ordens_servico.auvo_task_id`.
4. Técnico nunca cria OS no PCM diretamente via Auvo — sempre passam pelo PCM primeiro.

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| **PCM decide, Auvo executa** (A) | Separação clara; idempotência garantida | Complexidade de sync bidirecional | **Escolhida** — negócio exige rastreio no PCM |
| Auvo é source of truth | Técnico familiar; execução nativa | Sem visibilidade gerencial; sem backlog GUT | Rejeitada — PCM precisa de dados estruturados |
| Dual source (ambos criam) | Flexibilidade | Conflito garantido; impossível auditar | Rejeitada — inaceitável operacionalmente |

## Consequências
**Positivas:**
- Zero OS duplicadas no Auvo por reenvio.
- Rastreio completo no PCM: da abertura ao fechamento.
- Auditoria: `auvo_sync_status`, `auvo_synced_at`, `auvo_sync_error` em cada OS.

**Negativas / trade-offs aceitos:**
- Toda OS precisa passar pelo PCM antes do Auvo — adiciona latência de 1 passo.
- Se PCM estiver fora do ar, técnicos não recebem novas tarefas no Auvo até a restauração.
- Reconciliação manual necessária se webhook do Auvo falhar (divergência temporária de status).
