---
name: tasks
description: Tasks da E01-S205
alwaysApply: false
---

# Tasks — E01-S205
- [x] T1 Migration 1911: tabelas, seleção, arquivar (dry-run), restaurar, RLS FORCE — AC-1..AC-6
- [x] T2 pgTAP (20 asserções) + contraprova (sem GUC → #15 falha; sem allowlist → #5/#7/#11/#12/#17/#18 falham) — AC-2..AC-5
- [x] T3 `inventario.sql` somente leitura com dependências
- [ ] T4 Dono aprova inventário e allowlist; executar `select * from pcm.arquivar_dados_teste_e2e(true)` (fora do PR)
