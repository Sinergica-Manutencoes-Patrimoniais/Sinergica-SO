---
name: design-E01-S14-fluxo-b-orcamento
description: Design arquitetural do Fluxo B — chamado extra-contratual → orçamento → aceite → OS. Pare aqui antes de codar.
alwaysApply: false
---

# Design — E01-S14 Fluxo B: Chamado Extra-Contratual → Orçamento → OS

> Status: **rascunho arquitetural bloqueado por 2 perguntas de negócio** (2026-07-04).
> Tier: Arquitetural. Não codar schema/UI/Edge Function antes de resolver as perguntas abaixo.

## Contexto
O Fluxo B cobre cliente já existente (`pcm.clientes`) que pede serviço **extra-contratual**. Não é
fluxo de lead/prospect (`comercial.leads`) e não deve ser misturado com o épico Comercial futuro.

Fluxo desejado:
```
chamado → tratamento humano/IA → requisição de serviço → orçamento → aceite do cliente → OS
```

## Decisão já fechada
- O critério Fluxo A vs Fluxo B é o pedido estar ou não coberto pelo contrato vigente.
- Não é por categoria, prioridade, valor estimado ou canal.
- Fluxo A continua sendo E01-S02: cria OS diretamente com `status='solicitacao'`, `origem='ze'`.

## Alternativas arquiteturais

### Alternativa A — Estados novos em `pcm.ordens_servico`
Adicionar estados como `aguardando_orcamento`, `orcamento_enviado`, `aguardando_aceite`.

**Prós:** menos tabelas, menor implementação inicial.

**Contras:** uma "OS" existiria antes do aceite, podendo poluir backlog GUT, Visão 360 e automações
Auvo/PMOC. O nome OS passaria a significar duas coisas: demanda aceita e proposta pendente.

### Alternativa B — Entidade pré-OS + orçamento
Criar `pcm.requisicoes_servico` para o pedido extra-contratual e uma entidade de orçamento
(`comercial.orcamentos` ou `pcm.orcamentos_servico`). Só criar `pcm.ordens_servico` depois do aceite.

**Prós:** mais fiel ao processo real; evita OS fantasma; separa "pedido em negociação" de "trabalho
aceito para execução".

**Contras:** mais schema, mais estados e mais tela/processo.

## Recomendação inicial do @architect
Preferir **Alternativa B**: `pcm.requisicoes_servico` + orçamento vinculado, com promoção para
`pcm.ordens_servico` apenas no aceite. Motivo: o PCM é system of record da operação; uma OS deve
representar trabalho aceito para planejar/executar, não uma proposta comercial ainda incerta.

## Perguntas de negócio bloqueantes
1. **Orçamento recusado pelo cliente:** o chamado/requisição é arquivado definitivamente, ou o
   cliente pode pedir revisão/segunda proposta mantendo o mesmo funil?
2. **Área do Cliente (E09):** no MVP do Fluxo B, o aceite/recusa acontece só via WhatsApp/atendimento
   humano primeiro, e a Área do Cliente entra depois, ou já precisa existir um ponto de aceite no
   portal do síndico?

## Próximo passo após resposta
Com as respostas, `@pm` escreve `spec.md`, `@sm` quebra `tasks.md`, e só então `@data-engineer`/
`@dev` codam schema, RLS, UI e automações.
