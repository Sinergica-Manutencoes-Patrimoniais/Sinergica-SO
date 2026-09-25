---
name: E01-S150-kanban-mover-os-manual
description: Permitir arrastar/mover OS entre colunas do Kanban PCM manualmente
alwaysApply: true
---

# E01-S150 — Kanban PCM: mover OS entre status manualmente

## Contexto
Kanban PCM (Chamados/OS) tem colunas por status (planejamento, execução, finalizada, etc).
Hoje: **dragável mas ineficaz** — solta e volta ao status anterior.
Tecnicamente: drag-and-drop existe (E01-S61), mas `handleStatusChange` não persiste em DB.

## Requisitos

### AC-1: Drag-and-drop funciona
- Arrasta OS de uma coluna pra outra
- Solta → status muda em DB
- Optimistic update (bolinha se move logo, persiste em background)

### AC-2: Validações
- Não permite mover se sem `pcm:escrita`
- Recusa transição inválida (ex.: finalizada → planejamento bloqueada, se regra existir)
- Erro na gravação → volta a coluna original

### AC-3: Histórico
- `pcm.os_status_eventos` registra o movimento (existe desde E01-S20)
- Mostrar "Movido para Execução por User em 12:34" no detalhe

### AC-4: SLA recalcula
- Ao mover pra "execução": inicia SLA real (E01-S07)
- Ao mover pra "finalizada": fecha SLA

## Fora de escopo
- Workflow customizável (estados fixos por ora)
- Permissão por coluna específica (hoje: `pcm:escrita` genérica)

## Tier
Pequeno (wireup de drag existente + RPC de status).

---

## Tarefas

1. **RPC:** criar ou reusar `fn_alterar_status_os` com validações
2. **Adapter:** `supabase-ordens-servico-adapter.ts` ganha `alterarStatusOs`
3. **UI:** `KanbanOrdensServico.tsx` wira handler de drop (é só falta de onDrop pra chamar adapter)
4. **UI:** toast de sucesso/erro, rollback visual em erro
5. **Testes:** unit (validação status) + pgTAP (RLS) + Playwright (drag visual)

---

## Validação
- `ci:local` verde
- Arrasta OS no Kanban, solta, status muda em DB
- Sem `escrita` recusa
- Toast confirma ou nega movimento
