---
name: spec
description: Contrato — espelho do catálogo de questionários (/questionnaires) e cobertura de checklist por OS (base da auditoria de qualidade).
alwaysApply: true
---

# Spec — Catálogo de questionários (checklists) no PCM

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Origem: `docs/AUDITORIA-AUVO-API.md`. A API expõe `GET /questionnaires` (catálogo + perguntas,
> só leitura). O PCM já captura a **resposta** do questionário no snapshot da tarefa (E01-S15) e a
> usa pra gerar backlog — mas não conhece o **catálogo**: não sabe qual checklist era esperado num
> tipo de serviço, nem consegue dizer "OS concluída sem checklist respondido".

## Resumo
Espelho `pcm.questionarios` (+ perguntas em jsonb). A OS mostra o checklist esperado × respondido;
métrica "% de OS concluídas com checklist" por técnico/período no dashboard. É o pré-requisito da
auditoria de qualidade por amostragem (proposta F6 do ESCOPO-MESTRE §14) e do radar de execução (F2).

## Critérios de aceite

### AC-1: Espelho do catálogo
- **Dado** o pull rodando
- **Quando** sincroniza
- **Então** `pcm.questionarios` reflete o Auvo (unique `auvo_id`, perguntas em jsonb, ativo/inativo)

### AC-2: Checklist esperado × respondido na OS
- **Dado** uma OS cuja tarefa tem questionário
- **Quando** o painel abre
- **Então** mostra o nome do questionário e o par esperado×respondido (respondido vem do snapshot
  já existente), com estado claro quando não respondido

### AC-3: Métrica de cobertura
- **Dado** OS concluídas num período
- **Quando** o dashboard PCM calcula
- **Então** expõe % com checklist respondido (geral e por técnico)

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Criar/editar questionário (API é read-only; edição continua no Auvo — exceção documentada).
- Fila de auditoria por amostragem (F6 — story própria depois desta).
- Regenerar backlog a partir de resposta (já existe — questionário→backlog, paridade v2).

## Rastreabilidade
- Auditoria: `docs/AUDITORIA-AUVO-API.md` · ESCOPO-MESTRE §6.1 (questionário→backlog), §14 F2/F6.
- Contrato API: `GET /questionnaires` — verificar payload real com credencial antes da migration.
- Arquivos-âncora: registry/pull, snapshot (`pcm.auvo_task_snapshots`), painel de OS, dashboard.
