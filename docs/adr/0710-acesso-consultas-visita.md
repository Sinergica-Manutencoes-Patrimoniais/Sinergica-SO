---
name: "docs-adr-0710-acesso-consultas-visita-md"
description: "Documento Sinérgica SO: ADR-0710 — Acesso limitado às consultas e comandos de Visita"
alwaysApply: false
---

# ADR-0710 — Acesso limitado às consultas e comandos de Visita

Status: preparada; não aplicada nem homologada.

As telas de prévia e materialização usam funções de 0468, 0744 e 0796, mas não há concessão de execução para `authenticated`. Conceder apenas essas quatro funções: a prévia verifica gate, autorização `plano.gerir` e `visita.confirmar`, Cliente do Plano, vínculo e limites; a consulta de legado verifica gate, as mesmas capacidades e Plano/relação do Cliente; os dois comandos exigem seus gates privados, capacidade, identidade e validação transacional existentes.

Nenhum gate é ativado, nenhuma tabela ou função interna recebe grant e `anon`/`service_role` continuam sem concessão. Esta concessão não constitui homologação nem habilita execução de tarefas Auvo. Testes de isolamento, autorização revogada, idempotência e concorrência, especialmente dos locks legados, e revisão adversarial continuam obrigatórios antes da ativação.
