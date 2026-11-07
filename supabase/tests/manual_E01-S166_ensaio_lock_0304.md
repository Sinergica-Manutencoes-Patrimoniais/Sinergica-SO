---
name: "supabase-tests-manual-e01-s166-ensaio-lock-0304-md"
description: "Documento Sinérgica SO: Ensaio sintético de lock da migration 0304"
alwaysApply: false
---

# Ensaio sintético de lock da migration 0304

Em 2026-11-05, PostgreSQL 17.6 no contêiner local isolado, banco descartável criado com `template0`, sem dados de usuário: tabela sintética com colunas e índices representativos de `pcm.ocorrencias_preventivas`, 200.000 linhas geradas por `generate_series` e 56 MB incluindo índices. A tabela não tinha as FKs, triggers, RLS, volume ou concorrência de produção.

A migration real `0304_E01-S166_origem_ocorrencia_legada.sql`, aplicada sem concorrência, levou 41 ms de tempo de parede incluindo chamada Docker/psql; as 200.000 linhas apresentaram `origem = legado`. Uma transação de leitura aberta antes da migration impediu o `ALTER TABLE`: com `lock_timeout = '1s'`, a migration falhou após aguardar a trava. Na ordem inversa, a migration executou dentro de transação mantida aberta artificialmente por quatro segundos; uma consulta `SELECT count(*)` concorrente com `lock_timeout = '1s'` também falhou por espera da trava. O `pg_sleep` simulou uma transação longa e não faz parte da migration.

Roteiro: criar banco descartável; criar tabela sintética representativa e índices; inserir 200 mil linhas sem dados reais; abrir `BEGIN; SELECT count(*) ...; SELECT pg_sleep(4); COMMIT;` em uma sessão e aplicar a migration com `lock_timeout = '1s'` em outra; repetir aplicando a migration em `BEGIN`, mantendo-a aberta com `pg_sleep(4)` e executando a leitura concorrente; conferir contagem de origem e remover banco. A ordem inversa exige restaurar a tabela sintética ao estado anterior, sem remover a coluna de tabelas reais.

O resultado demonstra contenção nas duas ordens, não tempo ou capacidade de produção. O ensaio não reproduz todas as estruturas, consultas, dados, cache, I/O e transações reais; portanto 41 ms não é previsão de janela. Não foram feitos deploy, acesso a dados reais ou chamadas ao Auvo.
