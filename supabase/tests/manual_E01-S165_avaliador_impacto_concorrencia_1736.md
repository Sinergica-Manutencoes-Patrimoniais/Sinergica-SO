# Avaliador de impacto e retorno legado concorrentes

Usar clone descartável isolado com migrations até 1736. Preparar `manual_E01-S165_avaliacao_legada_revisao_1736.sql` até o comentário `Avaliador real`, incluindo recursivamente os arquivos `\ir`, e confirmar apenas os dados sintéticos. A escolha PCM `somente_legado` deve inicialmente resultar em `legadasSemPonteObservada=0` no avaliador de Visita.

Na sessão A como `service_role`, inserir avaliação sintética para a ocorrência `16610000-0000-0000-0000-000000000936` pela RPC `pcm.upsert_avaliacoes_preventivas` e manter a transação aberta. Na sessão B, chamar `pcm.sso_avaliar_fontes_impacto_visita_legado` com claims do ator da fixture: deve receber `55P03`. Confirmar A; nova avaliação deve retornar `legadasSemPonteObservada=1`.

Na ordem inversa, restaurar a fixture somente no clone, iniciar o avaliador na sessão A e manter transação aberta. A RPC de retorno na sessão B deve aguardar. Reverter A e confirmar o retorno; executar avaliador novamente e conferir `legadasSemPonteObservada=1`. Descartar o clone.

As duas ordens passaram em clone isolado. A prova cobre Visita e um retorno sintético; não cobre Calendário, todas as fontes ou operação Auvo.
