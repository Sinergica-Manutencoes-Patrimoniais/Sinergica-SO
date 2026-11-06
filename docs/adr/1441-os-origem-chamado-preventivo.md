---
name: "docs-adr-1441-os-origem-chamado-preventivo-md"
description: "Documento Sinérgica SO: ADR 1441 — Origem preventiva das OS de um Chamado"
alwaysApply: false
---

# ADR 1441 — Origem preventiva das OS de um Chamado

OS novas vinculadas a Chamado de ciclo preventivo usam o Cliente, alvo, tipo de tarefa explícito e questionário da fotografia aprovada da Rotina. O vínculo da OS ao Chamado dá acesso à origem imutável do ciclo, inclusive para Grupo Quantitativo; não se infere um Equipamento para representar o Grupo. A operação recusa alterações incompatíveis e não altera registros antigos.

O vínculo legado direto de ocorrência continua separado: seus consumidores, envio e retorno ainda precisam ser integrados ao novo caminho. Validar compatibilidade com múltiplas OS, alterações, ACL, concorrência, revisão e rollout antes de homologação.
