---
name: tasks
description: Decomposição e gates — aposentadoria de comercial.leads em duas etapas.
alwaysApply: false
---

# Tasks — E03-S10 · Aposentar `comercial.leads`

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S10-aposentar-comercial-leads`.
> ⚠️ **Não iniciar sem a S09 em produção.** A task 1 é uma trava, não uma formalidade.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Trava**: confirmar em produção que a S09 está deployada e que `comercial.leads` não tem `created_at` posterior ao deploy dela. Se tiver, **parar a story** e reabrir a S09 | AC-1 | — | `supabase db query --linked` (read-only) | todo |
| 2 | Migrar eventuais linhas restantes para `comercial.oportunidades` reusando a lógica da RPC da S09; conferir contagem origem × destino por query | AC-2 | 1 | `supabase db query --linked` | todo |
| 3 | Migration A `NNNN_E03-S10_leads_readonly.sql`: revoga INSERT/UPDATE de `service_role` e `authenticated`; tabela segue legível. Comentário explicando que o drop vem na migration B | AC-3 | 2 | `pnpm run lint:migrations` | todo |
| 4 | Decidir e implementar o destino de `atendimento.conversas.lead_id` — reaponta para `oportunidade_id` ou é removida se já houver equivalente. Registrar a decisão no `spec.md` desta story | AC-4 | 2 | `pnpm run lint:migrations` | todo |
| 5 | Converter `relacionamento.vinculos` com `entidade_tipo='comercial_lead'` para `'pcm_cliente'` e retirar o valor do check | AC-5 | 2 | `pnpm run lint:migrations` | todo |
| 6 | Migration B `NNNN_E03-S10_drop_leads.sql`: `drop table comercial.leads` com o **DDL completo de recriação no comentário de rollback** | AC-6 | 3, 4, 5 | `pnpm run lint:migrations` | todo |
| 7 | Limpeza de código: buscar `comercial.leads` / `from("leads")` em `apps/`, `supabase/functions/`, testes e tipos; regenerar `packages/database` | AC-7 | 6 | `rtk proxy grep -rn "comercial.*leads" .` deve voltar vazio (fora de docs/ADR) | todo |
| 8 | `pnpm run ci:local` + Playwright (dev server local): Inbox do Atendimento abre conversa antiga sem erro (prova do AC-4), funil intacto + ROADMAP/STATE/ARCHITECTURE (tirar da dívida de fronteira) | todos | 1–7 | `pnpm run ci:local` | todo |

## Plano de teste
- **Query de conferência** (task 2): contagem de origem = contagem de destino, antes de qualquer drop.
- **Playwright**: o Inbox é o que mais pode quebrar com a mudança da FK — abrir conversa antiga é
  o teste que importa.
- **Busca textual** (task 7) como gate: referência esquecida em tipo gerado só aparece em runtime.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Executar antes da S09 e quebrar o agente em produção | Task 1 é trava explícita |
| Perder lead que chegou no meio do caminho | Task 2 migra antes; AC-1 detecta escrita nova |
| Inbox quebrar pela FK | Task 4 decide com o uso real; Playwright confere |
| Tipo gerado referenciando tabela morta | Task 7 regenera e busca textual |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] `docs/ARCHITECTURE.md`: item 3 da "Dívida de fronteira" removido
- [ ] ROADMAP/STATE atualizados
