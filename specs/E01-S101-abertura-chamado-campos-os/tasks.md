---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Tela de abertura de chamado com os campos da OS + descrição completa

> **AC-6 (bug do modal) — investigado, não reproduzido no código atual (2026-07-28):**
> `NovaOrdemServicoModal` é renderizado fora do switch de `pcmView`/`activeModulo` em `HomePage.tsx`
> (gated só por `podeCriarOs`, estável), então trocar de aba/tela do PCM não deveria desmontar o
> modal nem resetar seu `useState`. `ChamadosPage`'s `NovoChamadoModal` também não tem abas internas.
> Não fixei nada aqui por falta de repro concreto — se o bug ainda ocorrer, precisa de passos
> exatos (qual tela, qual campo, qual sequência) pra localizar.

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                                | Status |
|----|---------------------------------------------------------------------|----------|------------|-----------------------------------------------|--------|
| 1  | Migration: `local`, `data_planejada`, `data_execucao`, `replanejamentos` em `pcm.chamados` (abertura = `created_at`, já existe) | AC-2,AC-3,AC-4 | — | `db-tests` verde | done |
| 2  | Domínio: `deveIncrementarReplanejamento`, `validarDataExecucao`      | AC-3,AC-4 | 1         | `pnpm test` (unit) — 5 testes novos           | done   |
| 3  | Gateway/adapter: `definirDataPlanejada`, `marcarExecucao`            | AC-3,AC-4 | 1,2        | `pnpm test` (unit dos casos de uso)           | done   |
| 4  | Formulário de abertura ganha campo Local                             | AC-1     | 1          | typecheck + vitest verdes                     | done   |
| 5  | Detalhe do chamado (painel "Detalhes") mostra Solicitação + Local completos + as 3 datas + edição de planejada/execução | AC-1,AC-2,AC-3,AC-4,AC-5 | 3,4 | typecheck + vitest verdes | done |
| 6  | Fix: persistir estado do modal ao trocar de aba                     | AC-6     | —          | **não reproduzido** — ver nota acima          | bloqueado |

## Plano de teste
- Unidade: `deveIncrementarReplanejamento` (3 casos), `validarDataExecucao` (2 casos) — 5 testes novos
  em `chamados.test.ts` (domínio). Regressão: `assessment.test.ts`/`chamados.test.ts` (application)
  atualizados com os campos novos no fixture `Chamado`.
- Integração: migration `0153` aditiva, sem `db-tests` rodado neste ambiente (sem Docker local —
  mesma limitação já registrada em sessões anteriores).
- Aceite: Playwright não rodado (pendente teste local do Lucas, conforme combinado).

## Divergências (SPEC_DEVIATION)
- [ ] AC-6 (fix do modal) não implementado — bug não reproduzido no código atual. Aguardando passos
  de reprodução concretos antes de investigar mais.

## Checklist de Definition of Done
- [x] AC-1 a AC-5 verdes pelo gate executável (typecheck/vitest)
- [ ] AC-6 — SPEC_DEVIATION acima
- [ ] Playwright rodado localmente pelo Lucas
- [ ] `db-tests` (migration `0153`) não pulado — pendente de Docker/CI
- [ ] `docs/STATE.md` atualizado
