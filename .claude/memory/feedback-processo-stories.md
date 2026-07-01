---
name: feedback-processo-stories
description: Processo obrigatório de stories/épicos com agentes Triviaiox — múltiplos devs simultâneos no Sinérgica SO.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f5f215d0-bb44-4034-b748-086da2842008
---

# Processo: Stories + Agentes Triviaiox (OBRIGATÓRIO)

Nunca implementar sem passar pelo processo de épicos/stories. Múltiplas sessões Claude podem estar em paralelo.

## Regra
1. Ler `docs/epics/ROADMAP.md` ao iniciar qualquer sessão de desenvolvimento.
2. Marcar o owner da story ANTES de codar qualquer linha.
3. Criar `specs/E0N-S0N-<nome>/spec.md` + `tasks.md` ANTES de implementar.
4. Seguir ciclo: `@pm/@analyst` → `@architect` (tier arq.) → `@sm` → `@dev` → `@qa` → `@devops`.
5. Atualizar ROADMAP.md + STATE.md ao concluir.

**Why:** Lucas tem múltiplos desenvolvedores (humanos + Claude) trabalhando em paralelo em épicos diferentes. Sem esse controle, há risco de conflito (dois devs na mesma story) e perda de rastreio (spec não registrada, AC não verificado).

**How to apply:** A CADA NOVA SOLICITAÇÃO DE FEATURE/STORY — antes de responder "vou implementar X", verificar o ROADMAP, abrir a story, criar spec+tasks. Só então implementar.

A story `E00-S01-login-home` foi implementada sem esse processo (SPEC_DEVIATION registrado). Não repetir.
