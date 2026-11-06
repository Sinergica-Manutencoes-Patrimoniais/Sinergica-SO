---
name: "docs-adr-1346-fila-preventiva-ciclos-canonicos-md"
description: "Documento Sinérgica SO: ADR-1346 — Entrada explícita de ciclo canônico na fila preventiva"
alwaysApply: false
---

# ADR-1346 — Entrada explícita de ciclo canônico na fila preventiva

Status: preparado, gate desligado; não homologado.

## Decisão

Preparar uma fila local por identidade canônica de ciclo, sem criar OS nem tarefas Auvo. A inclusão exige decisão explícita do PCM, permissão `plano.gerir`, motivo e uma ocorrência preparada ligada inequivocamente à fonte preventiva legada. A fonte deve indicar candidata aguardando, sem resultado, OS ativa ou tarefa externa comprovada pelo diagnóstico existente. O mesmo ciclo não pode criar duas entradas, mesmo que apareça em outra versão do Plano. Cancelamento é auditado, preserva histórico e impede reinclusão automática ou manual por este comando.

Consultas e comandos permanecem atrás de gate fechado. Para evitar leitura de fonte durante alteração concorrente por escritores legados, a inclusão usa locks de tabela `SHARE NOWAIT` nas fontes verificadas e falha se houver contenção. Isso tem custo e risco operacional significativos; avaliar outra estratégia antes de rollout. Os comandos são idempotentes por pedido e não escrevem na fonte preventiva, OS ou Auvo.

## Limites

Esta primeira entrada cobre apenas ciclos já preparados e vinculados a uma fonte legada inequívoca. Não cobre Grupo, ocorrência sem vínculo, integração externa, cancelamentos por outros caminhos, nem materialização retroativa. Diagnóstico legado não prova inexistência de todos os efeitos externos. Não afirmar conclusão de AC-6 nem habilitar o gate: antes disso inventariar todos os escritores e cancelamentos, projetar reconciliação de efeitos existentes, testar concorrência, RLS/FORCE, permissões e revisão adversarial. Nenhuma migration ou efeito é aplicado por esta decisão.
