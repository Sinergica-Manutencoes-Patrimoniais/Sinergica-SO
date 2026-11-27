---
name: tasks
description: Tasks da E01-S205
alwaysApply: false
---

# Tasks — E01-S205
- [x] T1 Migration 1911: tabelas de allowlist e log com RLS FORCE, sem grant a authenticated — AC-6
- [x] T2 Seleção `e2e_selecionar_arquivaveis` (clientes, hierarquia, equipamentos, ferramentas, chamados, OS) — AC-1, AC-2
- [x] T3 `arquivar_dados_teste_e2e` dry-run por padrão, linha a linha, sem enfileirar no Auvo — AC-3, AC-4, AC-6
- [x] T4 `restaurar_dados_teste_e2e` (reversão pelo log) — AC-5
- [x] T5 pgTAP 23 asserções + contraprovas (GUC, allowlist, exceção por linha, filtro auvo_task_id) — AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- [x] T6 `inventario.sql` somente leitura com dependências — AC-1
- [x] T7 Seletores já filtram `deleted_at IS NULL`; nenhum código novo — AC-7
- [ ] T8 Dono aprova inventário e allowlist; executar `select * from pcm.arquivar_dados_teste_e2e(true)` (fora do PR)
