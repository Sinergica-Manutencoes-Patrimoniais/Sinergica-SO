---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Assessment: importar questionário mesmo sem tarefa concluída (+ re-sync)

> **Fonte da verdade.** Origem: Lucas (2026-08-04, item 1). "A parte do assessment pede id da tarefa
> mas após preencher nada acontece. Pode trazer também o questionário mesmo se não estiver com
> status concluído, e depois atualizamos com informações atualizadas após concluir."

## Contexto de código — causa raiz
- `AssessmentPage.tsx` (E01-S90) → `confirmarImportar(auvoTaskId)` → `importarQuestionario` →
  adapter `importarQuestionarioAuvo` (`supabase-qualidade-adapter.ts` ~L940-1026).
- O adapter lê o checklist **só de `pcm.auvo_task_snapshots`** (E01-S15) via `.maybeSingle()`. Esse
  snapshot **só é gravado quando a tarefa Auvo é concluída** (webhook `pcm-auvo-webhook`). Tarefa
  **não concluída** → sem snapshot → `mapearQuestionarioParaQuestoes([])` → `questoes.length === 0`
  → pula a IA → `setItens([])`: **nada acontece, sem mensagem** (o "nada acontece" reportado).
- Import roda a IA (`processarRelatorioInspecao` → Edge `importar-relatorio-pdf`, E01-S96/S98) e é
  idempotente por assessment (bloqueia reimportar se já houver itens de questionário).

## Resumo
Buscar o questionário/checklist **ao vivo da API Auvo** por task id (não só do snapshot de
conclusão), pra funcionar mesmo com a tarefa em andamento. Quando não houver checklist, dizer
claramente (nunca no-op silencioso). Marcar a importação como **provisória** e, quando a tarefa for
concluída (webhook), **atualizar** com os dados finais.

## Critérios de aceite

### AC-1: Importa mesmo sem conclusão (fetch ao vivo)
- **Dado** um assessment e uma tarefa Auvo **em andamento** (não concluída) com checklist preenchido
- **Quando** o operador informa o task id e confirma
- **Então** o checklist é buscado ao vivo da Auvo, roda a classificação por IA e os itens aparecem —
  não depende mais do snapshot de conclusão.

### AC-2: Nunca no-op silencioso
- **Dado** um task id sem checklist (tarefa sem questionário, ou id inexistente)
- **Quando** o operador confirma
- **Então** aparece mensagem clara ("Tarefa sem questionário preenchido ainda" / "Tarefa não
  encontrada no Auvo"), não uma tela que "não faz nada".

### AC-3: Importação provisória marcada
- **Dado** um import feito com a tarefa ainda não concluída
- **Quando** os itens são gravados
- **Então** ficam marcados como **provisórios** (a resposta pode mudar até a conclusão), visível na UI.

### AC-4: Re-sync na conclusão
- **Dado** um assessment importado provisoriamente
- **Quando** a tarefa Auvo é concluída (webhook grava o snapshot final)
- **Então** os itens do assessment são atualizados com o checklist final (marcados como definitivos) —
  sem perder derivações já feitas pelo operador (chamado/OS geradas de um item continuam válidas).

## Casos de borda e erros
- Erro/quotas da IA (OpenRouter): mensagem real legível (E01-S96), sem esconder atrás de genérico.
- Reimport: mantém a idempotência atual (bloqueia se já há itens de questionário; reimportar exige
  limpar antes) — mas o re-sync automático da conclusão (AC-4) é atualização, não reimport bloqueado.
- Auvo indisponível no fetch ao vivo: erro claro, não grava assessment vazio.

## Fora de escopo
- Reprocessar automaticamente a IA a cada mudança do checklist antes da conclusão (só na importação
  manual e no evento de conclusão).
- Editar o checklist no Auvo a partir do SO.

## Rastreabilidade
- Código: `pages/AssessmentPage.tsx`, `application/assessment.ts`,
  `infrastructure/supabase-qualidade-adapter.ts` (`importarQuestionarioAuvo` — trocar fonte:
  snapshot → fetch ao vivo), **nova/estendida Edge Function** que busca checklist da tarefa por id
  na Auvo (`_shared/auvo/client.ts`), `pcm-auvo-webhook` (dispara re-sync AC-4).
- Estende: E01-S90 (assessment), E01-S98 (IA no questionário), E01-S15 (snapshot na conclusão).
- ADRs relacionados: —
