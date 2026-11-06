---
name: "docs-adr-1071-aprovacao-continuacao-parcela-md"
description: "Documento Sinérgica SO: ADR-1071 — Aprovação de continuidade vinculada à parcela"
alwaysApply: false
---

# ADR-1071 — Aprovação de continuidade vinculada à parcela

**Status:** preparação privada, não homologada. Complementa ADR-0981 e E01-S167.

A operação confere proposta e revisão do Chamado, fotografia da OS anterior, descrição/minutos remanescentes, atribuição única e situação da parcela. Para origem Backlog, exige ciclo em tratamento e vínculo explícito da proposta; para origem direta, exige atribuição direta comprovada. Proposta já devolvida não pode gerar outra OS. Aprovação usa o comando proprietário e registra vínculo imutável da nova OS à parcela na mesma transação. A nova OS recebe descrição restante; esforço permanece na proposta executada e é consultável pela função de esforço existente.

A origem da parcela pode ser a atribuição inicial ou uma continuidade já registrada e coerente com a proposta executada. Uma OS anterior só pode originar uma continuidade para a mesma parcela. O vínculo de novas propostas de Backlog ainda depende do fluxo proprietário, que deve ser adaptado para reconhecer OS de continuidade; não inferir esse vínculo.

Gate novo desligado e sem EXECUTE externo; não agenda nem envia Auvo. O novo vínculo não substitui a atribuição original nem altera apuração de cobertura automaticamente. Antes de ativar, integrar consumidores de escopo/capacidade, inventariar escritores e triggers, comprovar parada/execução, revisar locks, RLS, repetição, concorrência com devolução e revisão adversarial. A aprovação não comprova que o restante declarado está correto.
