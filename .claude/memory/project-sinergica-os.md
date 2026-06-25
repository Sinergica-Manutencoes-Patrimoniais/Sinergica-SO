---
name: project-sinergica-os
description: "Estado e decisões do projeto Sinérgica OS — casca concluída, próximo passo é implementar os módulos."
metadata: 
  node_type: memory
  type: project
  originSessionId: f5f215d0-bb44-4034-b748-086da2842008
---

# Sinérgica OS — Estado do Projeto

**Fase atual:** Casca concluída (Mês 1 do contrato). Pronto para construção dos módulos (Mês 2).

**Commit inicial:** `0c2f4f1` em main. Sem push ainda (autoridade do @devops/Lucas).

## Decisões estruturais tomadas
- Monorepo `apps/web` único com features por bounded context (não apps separados).
- Padrão OS v2 (Trívia Studio) com Triviaiox wired (squad `trivia-os`).
- PCM como origin of truth; Auvo como braço de campo com `externalId` idempotente (ADR-0001).
- Detecção determinística de menção ao Zé antes do LLM (ADR-0002).
- Dinheiro em centavos (inteiro) — herdado do Padrão OS.

## Gates (todos verdes no commit inicial)
- `pnpm --filter @sinergica/web test` → 20 testes (log, env, GUT)
- `pnpm --filter @sinergica/web typecheck` → limpo
- `pnpm --filter @sinergica/web lint` → limpo (Biome)
- `node scripts/audit-esteira.mjs` → 76 docs OK
- `node scripts/eval-spec-fidelity.mjs` → rastreabilidade OK

## Specs
- `0001-priorizacao-backlog-gut` — implementado, todos ACs verdes.
- `0002-abertura-chamado-ze` — spec completa (product, domain, design, spec, tasks), aguarda implementação Mês 2.

## Bloqueios pendentes
- Supabase: projeto não provisionado ainda (Lucas destrava).
- Evolution API: webhook não apontado para Edge Functions ainda.

**Why:** Casca da OS criada do zero — o PCM v2 legado (`pcm-sinergica-v2`) serve apenas como fonte de regras de negócio, não é reaproveitado.

**How to apply:** Ao retomar, ler `docs/STATE.md` e `specs/0002-abertura-chamado-ze/tasks.md` para saber o próximo passo concreto.
