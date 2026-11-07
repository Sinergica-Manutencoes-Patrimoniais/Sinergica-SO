---
name: "supabase-tests-manual-e01-s165-avaliacao-aprovacao-concorrencia-1742-md"
description: "Documento Sinérgica SO: Avaliação concorrente à fotografia da aprovação"
alwaysApply: false
---

# Avaliação concorrente à fotografia da aprovação

Usar clone descartável com migrations até 1742. Preparar `manual_E01-S165_avaliacao_aprovacao_obsoleta_1742.sql` até antes do trecho que desabilita gatilhos; confirmar a preparação sintética, sem desabilitar gatilhos nem modificar a guarda 1045. Obter a preparada e a legada vinculada da fixture.

Na sessão A, inserir avaliação da legada e manter transação aberta. Na B, executar `pcm.sso_fotografia_os_comparacao_aprovacao` para o Cliente e Plano da fixture, a preparada e tipo `calendario`: deve retornar `55P03`. Reverter A. Na ordem inversa, manter a fotografia aberta e tentar a inserção concorrente: deve aguardar ou atingir `lock_timeout`. Reverter ambas e descartar o clone.

As duas ordens passaram. A fixture SQL de 1742 também provou recusa do gatilho com avaliação tardia, isolando temporariamente outros gatilhos dentro de transação revertida. A concorrência acima cobre o helper, não uma aprovação integral 1731 nem todos os tipos de ocorrência.
