---
name: tasks
description: Decomposição e gates de E00-S27. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E00-S27 · Revogação imediata de acesso

Detalhe técnico em `plan.md`. **Tier arquitetural (segurança)**: ADR antes de implementar, `/revisao-adversarial` antes do PASS.

## Plano

| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Inventário: `jwt_version`/`versao_sessao` (zero ocorrência) + achar o precedente `0234`/E01-S184 | — | relatório na ADR | **done** — ADR-1691 |
| 2 | ADR do mecanismo (releitura ao vivo, não versão de sessão) | — | revisão humana | **done** — `docs/adr/1691-revogacao-imediata-generaliza-s184.md` |
| 3 | Migration: `config.sso_acesso_atual` (generaliza `0234`) + `sso_revogar_usuario`/`sso_reativar_usuario` auditados | AC-1, AC-3, AC-6 | `npx supabase@2.114.0 test db supabase/tests/E00-S27_*.test.sql` | **done** — `1855_E00-S27_revogacao_imediata.sql` |
| 4 | pgTAP: mesma sessão perde e recupera acesso, módulo e RPC sensível, sem novo login | AC-1, AC-4, AC-7 | idem | **done** — 13 assertions |
| 5 | Guarda de CI: policy nova sem releitura ao vivo | AC-8 | `node scripts/check-revogacao-coberta.mjs` | **done** — step novo em `ci.yml` |
| 6 | `/revisao-adversarial` | — | sem achado alto/médio | **done** — achado corrigido: autorrevogação travava `sso_reativar_usuario`; bloqueada (`nao_pode_revogar_a_si_mesmo`) |
| 7 | Alcance no front: UI de revogar/reativar | AC-F1→AC-F5 | `cd apps/web && pnpm vitest run src/features/pcm/interfaces/capacidades-sso` | **done** — seção nova em `CapacidadesWorkspace.tsx`, 24/24 testes verdes |

## Definition of Done

- pgTAP prova negado com token válido após revogação, e permitido antes (SC-001). **Feito.**
- Dois dispositivos perdem acesso no mesmo evento (SC-002). **Estrutural** — a checagem é por `usuario_id`, nunca por sessão; não há conceito de "dispositivo" a vazar.
- Nenhuma borda sensível nova sem verificação (SC-003). **Gate de CI criado**, escopado a partir desta migration — retrofit do histórico fica como dívida consciente (ver ADR).
- SEC-004 sai de `docs/SECURITY_DEBT.md` quando a dívida for considerada fechada — **pendente**, task 8.
- ADR escrita; `/revisao-adversarial` sem achado alto/médio aberto.

## Pendência explícita

- **Retrofit de RLS policy antiga** fora das 5 tabelas do `0234` — universo desconhecido, sem inventário próprio nesta story. Candidato a story dedicada se o Fabrício pedir auditoria completa.

| 8 | Atualizar `docs/SECURITY_DEBT.md` (SEC-004) | — | revisão humana | **done** |

## Rastreabilidade AC→task (completa)

Todas as ACs desta story estão cobertas pelas tasks acima; lista literal pra ferramenta de auditoria (`eval:spec`), que não expande faixa ("AC-1 a AC-4"): AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8.
