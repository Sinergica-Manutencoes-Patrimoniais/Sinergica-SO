---
name: "docs-adr-0130-central-consulta-materiais-md"
description: "Documento Sinérgica SO: ADR-0130 — Consulta central de listas de materiais por Cliente"
alwaysApply: false
---

# ADR-0130 — Consulta central de listas de materiais por Cliente

## Estado

Proposta E01-S179; não aplicada, não testada nem homologada. Complementa ADR-0099.

## Decisão

O vínculo canônico lista–OS já existe, com chave composta por Cliente. A central consulta esse vínculo sem criar associação paralela: exige Cliente autorizado, permite filtrar OS e responsável pelo fornecimento, pagina pela identidade da lista e retorna apenas OS ativas do mesmo Cliente. A ação abre o workspace existente da OS, que mantém comandos de criação e revisão próprios. Consulta não altera dados nem envia tarefas.

## Gates

RPC sem EXECUTE para papéis de aplicação; interface com flag desligada. Antes da ativação, testar autorização e isolamento, concorrência com remoção e mudança de Cliente da OS, paginação, invalidação e navegação; revisão adversarial e CI com db-tests são obrigatórios. Filtro global de Clientes e integração de Chamado permanecem pendentes. Não aplicar a migration nesta etapa.
