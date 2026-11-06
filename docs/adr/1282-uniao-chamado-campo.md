---
name: "docs-adr-1282-uniao-chamado-campo-md"
description: "Documento Sinérgica SO: ADR-1282 — União e duplicidade de Chamado de campo"
alwaysApply: false
---

# ADR-1282 — União e duplicidade de Chamado de campo

Status: proposta local; não aplicada nem homologada.

Preparar união ou marcação de duplicidade do Chamado provisório a outro Chamado ativo do mesmo Cliente. A OS é transferida preservando UUID, número, tarefa Auvo, execução e evidências; o contêiner original é cancelado com motivo e mantém histórico e vínculo na auditoria. Origem e destino são bloqueados em ordem de UUID; revisão dos dois Chamados e fotografia da OS são conferidas na transação. Repetição idêntica retorna o mesmo recibo.

A operação é bloqueada quando origem possui outras OS ou escopo estruturado, ou há divergência de Cliente, identidade, estado ou revisão; essas situações exigem protocolo complementar. Cancelar o contêiner sem destino não é coberto: precisa preservar vínculo da OS sem violar as guardas legadas. O gate nasce fechado; antes de habilitar, revisar todos os consumidores de vínculo, triggers e números, integrações, concorrência, revogação, rollback, RLS/FORCE e teste adversarial. Não cancelar ou alterar tarefa remota.
