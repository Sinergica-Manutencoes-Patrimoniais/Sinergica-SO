# Tasks — E01-S192

- [x] T1 — Diagnóstico Agenda do Técnico: causa nomeada com evidência (AC-1). Ver plan.md.
- [x] T2 — Diagnóstico Preventivas: causa nomeada, inventário Plano/Rotina/Ocorrência (AC-2, pergunta 17). Ver plan.md.
- [x] T3 — Migration `1854_E01-S192_...sql`: `pcm.operacao_itens` ganha `ocorrencia_preventiva_id`; `pcm.sso_resolver_plano_origem_os` (AC-9).
- [x] T4 — pgTAP `E01-S192_ocorrencia_preventiva_operacao_itens.test.sql` (8 assertions, PASS).
- [x] T5 — Frontend: propaga `ocorrenciaPreventivaId` (`operacao-gateway`, `supabase-operacao-adapter`, `supabase-hub-os-adapter`, `operacao-queries`, `domain/ordens-servico`); `OrdensServicoPage.tsx` resolve e exibe "Plano de origem" no drawer do Kanban (AC-9).
- [x] T6 — AC-4/AC-5/AC-6 verificados já implementados (estados distintos na Agenda; terceiro separado em `capacidade-agenda/`) — sem código novo, só confirmação.
- [x] T7 — AC-7/AC-8 verificados já implementados em `PreventivasPage`/`PreventivaDetalheDrawer` — sem código novo, só confirmação.
- [ ] T8 — SPEC_DEVIATION: AC-3 ("OS vinculadas" na Agenda) não implementado — requer decisão de pipeline (quem escreve `pcm.agenda_tecnico` a partir de OS/Visita), fora do escopo unilateral. Documentado em plan.md; story dedicada necessária.
- [x] T9 — Suíte local: pgTAP completa (268 arquivos/3379 testes, PASS), typecheck `apps/web` (0 erros), testes `src/features/pcm` (2054 PASS), `biome-baseline.mjs` (zero dívida nova).
