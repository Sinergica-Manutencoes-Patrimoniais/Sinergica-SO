---
name: "docs-adr-1337-confirmar-chamado-os-atomico-md"
description: "Documento Sinérgica SO: ADR-1337 — Confirmar Chamado de OS avulsa atomicamente"
alwaysApply: false
---

# ADR-1337 — Confirmar Chamado de OS avulsa atomicamente

**Estado:** proposta; não aplicada nem homologada.

## Contexto

O caminho legado cria Chamado, vincula a OS e registra evento em chamadas separadas. Perda de resposta ou concorrência pode deixar Chamado órfão ou substituir vínculo já existente. A story S167 determina preservar números existentes.

## Decisão

Preparar comando transacional com identificador de pedido estável, autorização pelo Cliente, trava da OS, evento e auditoria. A operação cria Chamado e vincula uma OS que ainda não possua Chamado; preserva o número da OS e fornece novo número ao Chamado. Dados do Chamado são derivados da OS travada. Repetição do mesmo pedido devolve o mesmo resultado depois de conferir ator e acesso. Resultados incertos devem ser repetidos com o mesmo identificador, nunca com pedido novo.

O caminho permanece atrás de flags fechadas até testes integrados e revisão. Nenhuma tarefa Auvo é criada pelo comando; triggers existentes precisam ser inventariados antes da ativação.

## Limites

O comando não reconcilia Chamados órfãos anteriores, não altera vínculos existentes e não libera 1:N. Preservar o número da OS muda a suposição antiga de igualdade com o número do Chamado; revisar todos os consumidores, integrações e usuários antes de substituir o caminho legado. Verificar permissões/revogação, locks, replay, persistência local do pedido, efeitos de triggers, concorrência e auditoria antes de rollout.
