---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Editar campos da OS no modal e re-sincronizar com o Auvo

> **Fonte da verdade.** Origem: pedido do Lucas (2026-08-04, item 2). "Quando abrir o modal
> permitir editar os campos possíveis de serem editados e sincronizar com o Auvo."

## Contexto de código
- O painel de detalhe (`DetalheOs`) já tem botão "Editar" (E01-S69, escondido para card sintético
  de Chamado sem OS — E01-S118). Hoje a edição grava só no PCM (`pcm.ordens_servico`).
- O write-path pro Auvo existe: trigger de status → `pcm-auvo-push` (outbox) → Edge Function
  `pcm-auvo-*` usa o registry `_shared/auvo/registry/` e o cliente `_shared/auvo/client.ts`. Hoje o
  push cobre criação de task (ao planejar) e sync de catálogos, **não** edição campo-a-campo de uma
  task já criada.
- Auvo API v2 tem `PUT /tasks` (atualização de tarefa). **Verificar na doc oficial quais campos são
  editáveis via API** antes de expor no modal — não inventar campo que a API rejeita.

## Campos editáveis (proposta — confirmar contra a API Auvo na implementação)
Título/descrição, orientação, data planejada, técnico responsável, prioridade. Campos derivados
(cliente, local de origem, número CH) **não** são editáveis aqui — mudam a identidade do Chamado.

## Resumo
No modal de detalhe, o modo "Editar" passa a permitir alterar os campos editáveis e, ao salvar,
além de gravar no PCM, **enfileira uma atualização da task no Auvo** (mesma outbox/idempotência do
push existente) quando a OS já tem `auvoTaskId`. Falha de sync com o Auvo nunca perde a edição no
PCM — fica pendente e visível.

## Critérios de aceite

### AC-1: Editar campos permitidos
- **Dado** uma OS com task Auvo aberta no modal
- **Quando** o operador entra em "Editar", altera um campo editável e salva
- **Então** o valor é gravado em `pcm.ordens_servico` e o modal reflete o novo valor.

### AC-2: Propaga pro Auvo
- **Dado** a edição salva de uma OS com `auvoTaskId`
- **Quando** o save conclui
- **Então** uma atualização da task correspondente é enfileirada pro Auvo (outbox), idempotente —
  não duplica task, atualiza a existente.

### AC-3: Campos não-editáveis bloqueados
- **Dado** o modo "Editar"
- **Quando** o operador olha os campos de identidade (cliente/local/número CH)
- **Então** eles aparecem read-only — não há caminho de UI pra alterá-los aqui.

### AC-4: Falha de sync não perde a edição
- **Dado** que o push pro Auvo falha (rede/erro API)
- **Quando** o operador salvou
- **Então** a edição no PCM persiste e o vínculo fica marcado como "sync pendente" (mesma saúde
  Auvo da E01-S123), sem travar a UI nem exibir erro genérico (reusa `edge-function-error`).

## Casos de borda e erros
- OS sem `auvoTaskId` (nunca foi pro Auvo): edita só no PCM, sem tentar PUT (não há task pra atualizar).
- Card sintético de Chamado sem OS (E01-S118): "Editar" continua escondido (fora de escopo).
- Edição concorrente (dois operadores): last-write-wins no PCM, o push carrega o estado final.

## Fora de escopo
- Editar cliente/local/número (identidade do Chamado).
- Editar campos que a API Auvo não aceita via `PUT /tasks` (confirmar quais são).
- Resolver conflito Auvo→PCM (webhook de status já trata a volta; aqui é só PCM→Auvo).

## Rastreabilidade
- Código: `pages/OrdensServicoPage.tsx` (`DetalheOs` modo editar), `application/hub-os.ts`,
  `infrastructure/supabase-hub-os-adapter.ts`, outbox/push `supabase/functions/pcm-auvo-push/`,
  `_shared/auvo/client.ts` (chamada de update), `lib/http/edge-function-error.ts`.
- Estende: E01-S69 (OS editável), E01-S47 (escrita real Auvo), E01-S123 (saúde/sync pendente).
- ADRs relacionados: —
