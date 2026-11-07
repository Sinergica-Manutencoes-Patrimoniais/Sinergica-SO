---
name: "supabase-tests-manual-e01-s166-series-rotina-concorrencia-1778-md"
description: "Documento Sinérgica SO: Série por Rotina: revogação e mudança de Cliente"
alwaysApply: false
---

# Série por Rotina: revogação e mudança de Cliente

Em 2026-11-05, migrations 1614–1778 foram aplicadas em ordem em clone descartável, com dados sintéticos de `manual_E01-S166_fila_visita_fixture.sql` confirmados apenas no clone. Exercitaram-se as RPCs autenticadas `sso_listar_series_rotina_mediado` (1777) e `sso_vincular_serie_rotina_mediado` (1778), com request e parâmetros da fixture `manual_E01-S166_vincular_serie_1778.sql`.

Para cada RPC, uma sessão executou a operação e manteve a transação aberta por quatro segundos enquanto a outra tentava revogar `plano.gerir`; as ordens foram invertidas. Nos quatro casos a primeira operação concluiu e a concorrente recebeu `55P03`/`autorizacao_em_alteracao`. Repetiu-se o ensaio com `UPDATE` do Cliente do Plano sintético: enquanto RPC estava aberta, o UPDATE excedeu `lock_timeout=1s`; enquanto UPDATE estava aberto, a RPC recebeu erro de lock NOWAIT. Em transação separada, após atualizar o Cliente sintético, as duas RPCs chamadas com Cliente anterior foram recusadas com `42501`. As transações foram revertidas.

Roteiro: criar clone sem rede e aplicar migrations em ordem; preparar a fixture Visita em transação confirmada só no clone; iniciar leitura ou vínculo e manter transação aberta, tentar revogação ou alteração do Cliente em outra sessão e inverter as ordens. Conferir códigos acima e repetir com Cliente alterado antes da chamada; reverter e remover clone. Não cobre todas as concessões, alterações de série, isolamento ou ambientes reais. Nenhum deploy, OS ou tarefa Auvo.
