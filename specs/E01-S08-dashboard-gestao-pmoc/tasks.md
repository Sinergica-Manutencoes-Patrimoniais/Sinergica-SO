---
name: tasks-E01-S08-dashboard-gestao-pmoc
description: Tasks — painel de alertas cross-contrato (domínio puro + UI, sem migration).
alwaysApply: false
---

# Tasks — E01-S08: Dashboard e gestão de contratos PMOC

## Plano
| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | domain `pmoc.ts`: `TipoAlertaPmoc`, `ContratoComAlerta`, `contratosComAlerta(contratos)` (categoriza + prioriza, um contrato só na categoria mais urgente) + `.test.ts` | AC-1, AC-2, AC-4 | `pnpm test` | ☐ |
| 2 | UI `PmocPage.tsx`: seção "Precisa de atenção" acima/ao lado da lista, agrupada por categoria, clicável (`setSelecionadoId`), estado "tudo em dia" quando vazio | AC-1, AC-3, AC-5, AC-6 | `pnpm build` | ☐ |
| 3 | Reconciliar ROADMAP + STATE | — | `pnpm run ci:local` | ☐ |

## Plano de teste
- **Unidade (Vitest):** `contratosComAlerta` — contrato com NC alta some da categoria "ART vencendo"
  mesmo se também `status='renovar'` (AC-4, prioridade); contrato sem alerta não aparece (AC-2);
  ordenação entre categorias.

## Divergências (SPEC_DEVIATION)
(nenhuma)

## Definition of Done
- [ ] AC-1..AC-6 verdes pelo gate executável
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP + STATE atualizados
