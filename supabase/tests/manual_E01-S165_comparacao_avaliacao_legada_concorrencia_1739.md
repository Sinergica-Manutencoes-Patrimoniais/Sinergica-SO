---
name: "supabase-tests-manual-e01-s165-comparacao-avaliacao-legada-concorrencia-1739-md"
description: "Documento Sinérgica SO: Comparação de impacto e avaliação legada concorrentes"
alwaysApply: false
---

# Comparação de impacto e avaliação legada concorrentes

Usar exclusivamente clone descartável com migrations até 1739. Preparar `manual_E01-S165_comparacao_avaliacao_legada_1739.sql` até o último bloco de teste, antes do `rollback`, e confirmar a transação sintética. Habilitar `pcm.sso_decisao_comparada_gate` somente no clone. Usar os identificadores da fixture e claims do ator sintético.

Na sessão A, inserir em `pcm.avaliacoes_preventivas` uma avaliação para a ocorrência legada vinculada à preparada e manter a transação aberta. Na sessão B, executar `pcm.sso_comparar_rotina_impacto_v3` para a preparada de Calendário: deve receber `55P03`. Reverter A. Na ordem inversa, abrir transação que consulta a comparação e mantê-la aberta: inserção concorrente deve aguardar ou atingir `lock_timeout`. Reverter as duas transações.

Para provar o CAS, obter a comparação, inserir a avaliação e passar a comparação anterior a `pcm.sso_decidir_impacto_comparado` com novo request: deve retornar `comparacao_obsoleta` (`40001`). Reverter a transação e descartar o clone.

As duas ordens e o CAS passaram em clone com vínculo de Calendário. O teste não prova todas as associações, não mede contenção entre Clientes e não executa Auvo.
