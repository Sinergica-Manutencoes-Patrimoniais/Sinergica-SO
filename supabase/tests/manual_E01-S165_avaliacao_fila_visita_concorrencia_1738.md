---
name: "supabase-tests-manual-e01-s165-avaliacao-fila-visita-concorrencia-1738-md"
description: "Documento Sinérgica SO: Retorno de avaliação e estado da fila de Visita"
alwaysApply: false
---

# Retorno de avaliação e estado da fila de Visita

Usar somente clone isolado descartável com migrations até 1738. Preparar `manual_E01-S165_S166_ponte_visita_mediada.sql` até a revogação final da concessão, mantendo a ponte e o ciclo da preparada `16610000-0000-0000-0000-000000000161`. Confirmar a preparação sintética e identificar `ciclo_id` e `ocorrencia_legada_id` pelas tabelas de vínculo.

Na sessão A, como `service_role`, inserir avaliação sintética para a legada por `pcm.upsert_avaliacoes_preventivas` e manter transação aberta. Na sessão B, `pcm.sso_estado_fila_visita` deve receber `55P03`. Após confirmar A, estado deve ser `indeterminado`.

Na ordem inversa, restaurar a fixture somente no clone e chamar o estado em transação na sessão A, mantendo-a aberta. O upsert na sessão B deve esperar o encerramento; após rollback de A e commit do retorno, estado deve ser `indeterminado`. Repetir o request já concluído de materialização deve retornar o recibo idêntico, sem produzir outra ocorrência. Descartar o clone.

Ambas as ordens passaram em clone, assim como comparação do replay. A fixture cobre uma ponte de Visita; não mede carga nem testa serviços externos ou Auvo.
