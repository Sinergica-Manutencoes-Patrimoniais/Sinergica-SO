---
name: ADR-0023
description: Workflow enxuto — Spec Kit como fluxo padrão, ROADMAP compacto, pre-push só nos afetados, personas Triviaiox opcionais (E00-S25)
alwaysApply: false
---

# ADR-0023 — Workflow enxuto (Spec Kit + gates proporcionais)

**Status:** Aceito
**Data:** 2026-09-30
**Decisores:** Lucas (PO)
**Relacionados:** `specs/E00-S25-workflow-enxuto/` · referência: PR #86 do repositório Atendimento

## Contexto
Cada sessão gastava ~85k tokens só de contexto inicial (ROADMAP de 278 KB lido inteiro), ativava
personas de 300–560 linhas e o pre-push rodava ~20 comandos (246 arquivos de teste). `/revisao-adversarial`
era exigida e não existia; hooks de graphify e `check-story` rodavam sem efeito. O Atendimento trocou o
ScafoldOS por Spec Kit com bom resultado, mas aqui o rastreio `E0N-S0N` (ROADMAP com owner, migrations,
commits) sustenta o trabalho paralelo e há 254 specs legadas.

## Decisão
1. **Spec Kit** (`speckit-specify/plan/tasks/implement`) é o fluxo padrão de story nova, em
   `specs/E0N-S0N-<nome>/`, com ids `AC-N`. Personas Triviaiox viram opcionais.
2. **ROADMAP compacto** (só stories em aberto, uma linha curta); histórico verbatim em `docs/epics/historico/`.
   Sessão lê só a linha da própria story.
3. **pre-push só nos afetados**; a bateria completa vai para a CI (que ganhou os gates de design, biome e build)
   e continua disponível em `pnpm run ci:local`.
4. **Mantidos sem alteração:** RLS FORCE + pgTAP (`db-tests`), Squawk, `lint:migrations`, gitleaks, `pnpm audit`,
   deno check/test, ADR para decisão irreversível, `SPEC_DEVIATION`, IDs `E0N-S0N`, PR obrigatório.
5. Legado intacto: specs `E0N-S0N` antigas não são migradas; `eval:spec` só avalia as tocadas no PR.

## Consequências
- Contexto inicial cai de ~300 KB para ~20 KB; pre-push cai de minutos para segundos em diff pequeno.
- Gates de design (`check-*.mjs`) só falham na CI, não mais no push local.
- `git push` passa a pedir confirmação por `permissions.ask` em vez de hook próprio.
- Regra que atrapalha mais do que protege é removida, não contornada (constitution).
- Rollback: tag `pre-enxugamento`.
