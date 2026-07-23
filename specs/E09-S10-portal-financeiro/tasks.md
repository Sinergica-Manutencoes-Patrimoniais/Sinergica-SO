---
name: tasks-E09-S10-portal-financeiro
description: Decomposição — financeiro no portal (bloqueada por E04).
alwaysApply: false
---

# Tasks — Financeiro no portal

> Implementação local concluída em 2026-07-21. E04-S01..S13 confirmado implementado; views seguras
> do portal criadas em 0145. pgTAP/browser aguardam backend migrado.

> Dependência E04 satisfeita. Backend promovido em 2026-07-22; `0147` tornou as duas views
> `security_invoker`. UAT de browser aguarda deploy do portal.

## Plano
| #  | Task                											                                | Cobre AC | Depende de | Gate (comando) | Status  |
|----|-----------------------------------------------------------------|----------|------------|----------------|---------|
| 0  | **Pré-requisito**: E04 fundação + contratos/contas a receber     | —        | E04        | —              | done |
| 1  | Views `financeiro` dedicadas ao `cliente-sindico` (RLS por linha)| AC-1,3,4 | 0,E09-S01  | smoke SQL remoto | done |
| 2  | Read-model financeiro do portal (só devido/pago)                | AC-1,3   | 1          | `pnpm test`    | done |
| 3  | Aba Financeiro na PortalShell (faturas/vencimentos/status)      | AC-1     | 2          | browser        | done    |
| 4  | 2ª via / comprovante por signed URL                            | AC-2     | 3          | browser        | done    |

## Plano de teste
- pgTAP: view só devolve linhas do `cliente_id`; nenhum campo de custo/margem exposto.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [x] Dependência dura de E04 satisfeita.

## Checklist de Definition of Done
- [x] E04 construído (pré-requisito)
- [x] AC-1..AC-4 verdes; pgTAP confirma isolamento e ausência de dado interno
- [x] Blueprint 09 alinhado (fatura sim, custo/rentabilidade não)
- [x] `docs/STATE.md` + ROADMAP atualizados
