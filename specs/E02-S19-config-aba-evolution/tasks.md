---
name: tasks
description: Decomposição e gates — aba Evolution (conexão/QR).
alwaysApply: false
---

# Tasks — Aba de config: Evolution

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0060/0061` reusando `canais_externos` + número vinculado, unicidade e RLS | AC-1,AC-2 | — | `supabase test db` | feito; pgTAP escrito, execução local bloqueada |
| 2  | Use-cases: criar/conectar (QR), status, reconectar/desconectar via Evolution API | AC-1,AC-2 | — | test do caso de uso (mock Evolution) | feito |
| 3  | Adapter Supabase/Evolution + Edge Function autenticada (segredo só no servidor) | AC-1,AC-2 | 1,2 | typecheck + `check:edge-functions` | feito |
| 4  | `EvolutionTab` (nova `TabId`) com QR + status + número | AC-1,AC-2 | 2,3 | typecheck + build | feito |
| 5  | Garantir não-regressão do vínculo instância→persona e roteamento do Zé | AC-3 | 4 | pgTAP `atendimento_evolution_rls` | feito; execução local bloqueada |
| 6  | Gates locais + ROADMAP/STATE | todos | 1–5 | comandos individuais equivalentes ao CI | feito |

## Plano de teste
- Unidade/Integração: conexão/status (mock Evolution). Regressão: roteamento persona (AC-3). Componente: aba. Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Task 4 · o workspace não possui runtime DOM/React Testing Library para teste de componente ·
  gate substituído por typecheck+build; UAT com uma Evolution real continua explícito, não simulado.
- [x] Task 6 · `lefthook pre-push` não enxerga arquivos sem commit e pulou os jobs · os comandos
  `lint`, `typecheck`, `test`, `build`, `arch:check`, `audit:esteira`, `eval:spec`,
  `lint:migrations` e `check:edge-functions` foram executados individualmente.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável (falta pgTAP e UAT contra Evolution real)
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] Sem regressão estrutural no roteamento do Zé (`instancias_agente`/`config_ze` intocados;
  pgTAP de compatibilidade escrito)
- [x] Spec reflete o que foi construído
- [x] `docs/STATE.md` atualizado

## Evidência local (2026-07-08)
- `pnpm lint`, `typecheck`, `test` (**263 pass/9 skip**), `build`, `arch:check`,
  `audit:esteira`, `eval:spec`, `lint:migrations` e `check:edge-functions`: verdes.
- `supabase test db`: não executou porque o Postgres local não está ativo em
  `127.0.0.1:54322`; o teste `supabase/tests/atendimento_evolution_rls.test.sql` ficou pronto para CI.
- Deno CLI ausente; runtime da Edge Function e QR real dependem do deploy/ambiente com
  `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`.
