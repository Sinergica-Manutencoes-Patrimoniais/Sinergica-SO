---
name: tasks
description: Decomposição e gates de E00-S26. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E00-S26 · Capacidades sensíveis ponta a ponta

Detalhe técnico em `plan.md`. **Tier arquitetural**: ADR antes de implementar, `/revisao-adversarial` antes do PASS.

## Plano

| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Inventário da fundação E01-S170 (schema, RPCs, UI, o que falta de verdade) | — | relatório na ADR | **done** — ADR-1690: fundação completa, gap é só flag frouxa |
| 2 | ADR do mapeamento das 7 capacidades sobre a taxonomia existente | — | revisão humana | **done** — `docs/adr/1690-capacidades-sensiveis-reaproveita-e01-s170.md` |
| 3 | Migration: `exige_concessao_individual=true` em `cadastro.aprovar`/`chamado.encerrar`/`custo.ler`/`visita.cancelar` | AC-1, AC-2, AC-3 | `npx supabase@2.114.0 test db supabase/tests/E00-S26_*.test.sql` | **done** — `1854_E00-S26_capacidades_sensiveis.sql` |
| 4 | pgTAP: matriz positiva e negativa AC-1 a AC-8 | AC-1→AC-8 | idem | **done** — 15 assertions, suíte completa 268/268, 3386/3386, zero regressão |
| 5 | Confirmar `execucao.validar` fica de fora (SPEC_DEVIATION) sem quebrar teste pré-existente | — | `npx supabase@2.114.0 test db supabase/tests/E01-S170_*.test.sql` | **done** — removido do flip após achar `E01-S170_perfis_acumulaveis.test.sql` provando herança intencional |
| 6 | Alcance no front — confirmar `CapacidadesWorkspace` já é o caminho utilizável | AC-F1→AC-F5 | revisão humana | **done** — já montada, superadmin, sem flag nova |
| 7 | `/revisao-adversarial` | — | sem achado alto/médio | todo |
| 8 | Linha de ativação no PR | AC-F5 | revisão humana | **já utilizável, sem passo de ativação pendente** |

## Definition of Done

- Matriz positiva e negativa coberta por pgTAP (SC-001). **Feito.**
- Nenhuma RPC sensível alcançável por escrita de módulo isolada (SC-002). **Feito** pros 4 códigos flipados; `execucao.validar` é divergência documentada.
- Nenhum custo interno sai do servidor sem `custo.ler` (SC-003). **Já era verdade antes desta story** — confirmado, não construído agora.
- Toda concessão aparece em `audit.*` (SC-004). **Já verdade** — `config.sso_registrar_comando` grava toda escrita em `sso_concessoes`/`sso_perfis`/`sso_usuario_perfis` desde `E01-S170`.
- ADR escrito; falta `/revisao-adversarial` (task 7) antes do PASS final.

## Rastreabilidade AC→task (completa)

Todas as ACs desta story estão cobertas pelas tasks acima; lista literal pra ferramenta de auditoria (`eval:spec`), que não expande faixa ("AC-1 a AC-4"): AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8.
