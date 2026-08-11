---
name: design-E01-S14-fluxo-b-orcamento
description: Design arquitetural do Fluxo B — chamado extra-contratual → orçamento → aceite → OS. Pare aqui antes de codar.
alwaysApply: false
---

# Design — E01-S14 Fluxo B: Chamado Extra-Contratual → Orçamento → OS

> **FECHADO (2026-08-11, E03-S12).** Este rascunho ficou bloqueado por mais de um mês enquanto a
> **E09-S09 já implementava o Fluxo B em produção** (`0144_E09-S09_portal_orcamentos.sql`), sem que
> o ROADMAP registrasse — descoberto na auditoria de schema de 2026-08-10. A E09-S09 escolheu a
> **Alternativa B** (a mesma que este design recomendava) e resolveu as 2 perguntas bloqueantes na
> prática, mesmo sem uma resposta formal documentada aqui antes de codar — ver respostas abaixo. A
> E03-S12 apenas formaliza o que já rodava: documenta o dono (PCM, R1, decisão 10 do E03) e publica
> a view de leitura pro portal (`pcm.portal_orcamentos_servico`, R2). Nenhum código novo de fluxo.
>
> ~~Status: rascunho arquitetural bloqueado por 2 perguntas de negócio (2026-07-04).~~

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

## Respostas de fato (retroativas, E03-S12, 2026-08-11)
A E09-S09 codou sem esperar resposta formal; documentando aqui o que o schema em produção decidiu:

1. **Orçamento recusado pelo cliente:** a requisição vai para `status='recusada'`
   (`pcm.requisicoes_servico`) e o orçamento para `status='recusado'`
   (`pcm.orcamentos_servico`) — **arquivado definitivamente**, sem fluxo de revisão/segunda
   proposta no mesmo funil. Pedir de novo significa abrir um chamado/requisição novos.
2. **Área do Cliente (E09):** o aceite/recusa **já nasceu no portal do síndico**
   (`pcm.portal_decidir_orcamento`, `security definer`) — não passou por uma fase intermediária
   via WhatsApp/atendimento humano antes de existir ponto de aceite no portal.

## Próximo passo após resposta
~~Com as respostas, `@pm` escreve `spec.md`, `@sm` quebra `tasks.md`, e só então `@data-engineer`/
`@dev` codam schema, RLS, UI e automações.~~ Não aplicável — implementação já existe e roda em
produção desde a E09-S09; ver nota de fechamento no topo.
