---
name: adr-1681-recibo-completo-reconciliacao-revisao-plano
description: Recibo completo e paginado como pré-condição para aprovar revisão de Plano.
alwaysApply: false
---

# ADR-1681 — Recibo completo de reconciliação da revisão do Plano

## Estado

Proposta pendente de revisão arquitetural, ensaio em banco descartável e homologação. Não autoriza deploy.

## Contexto

Uma revisão pode manter, alterar ou retirar ciclos já materializados e pode afetar ordens de serviço abertas. Fontes legadas sem vínculo comprovado tornam incompleta qualquer conclusão de ausência de impacto.

## Decisão

Exigir recibo mediado, paginado e íntegro que compare snapshots por Rotina lógica, alvo inequívoco, ciclo e vencimento original, incluindo o questionário aplicável e ordens de serviço localizadas por ponte comprovada. Cada item recebe decisão `manter`, `alterar`, `retirar` ou `indeterminada`. Aprovação fica bloqueada enquanto houver página pendente, fonte obrigatória indisponível, vínculo não classificado ou item indeterminado.

## Consequências

Consulta e prévia não alteram estado. A confirmação é um comando separado, revisionado e auditado. Ausência de vínculo não equivale a ausência de ordem de serviço; falhas fecham a aprovação. Nenhuma tarefa real é enviada ao Auvo por esta reconciliação.

A RPC de aprovação revalida o recibo completo no servidor sob o protocolo transacional e deriva do histórico se a ação é aprovação inicial ou revisão. Não confia em indicador booleano enviado pelo cliente nem somente no estado visual do Workspace.

## Validação pendente

Revisão adversarial, testes de paginação completa, fonte ausente, OS aberta por vínculo comprovado, dados legados não classificados e concorrência de aprovação.
