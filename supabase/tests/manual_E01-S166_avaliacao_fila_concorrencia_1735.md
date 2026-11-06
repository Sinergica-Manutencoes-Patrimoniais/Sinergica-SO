# Avaliação legada concorrente com fila e Chamado

Usar somente clone descartável isolado com migrations até 1735. Preparar `manual_E01-S166_retomada_fila_aguardando.sql` até imediatamente antes da inserção `fixture-1735-depois-fila`, incluindo recursivamente os arquivos `\ir`; confirmar a preparação sintética para usar duas sessões. A ocorrência preparada tem ponte legada e entrada `aguardando` sem avaliação.

Na sessão A, como `service_role`, chamar `pcm.upsert_avaliacoes_preventivas` com avaliação sintética da ocorrência legada e manter transação aberta. Na sessão B autenticada, consultar `pcm.sso_consultar_entrada_fila_preventiva_v2` e tentar `pcm.sso_criar_chamado_ciclo_preventivo`: ambas devem receber `55P03`. Confirmar A: a consulta deve retornar `estado=verificacao` e `situacao_atual=verificacao`; Chamado novo deve ser recusado com `avaliacao_legada_exige_reconciliacao`.

Na ordem inversa, restaurar a fixture apenas no clone, consultar a entrada sem avaliação na sessão A e manter transação aberta. Na sessão B, chamar o upsert: deve aguardar a leitura terminar. Reverter A; o retorno sintético deve ser preservado e nova consulta deve exibir verificação. Descartar o clone.

Ambas as ordens passaram com código final 1735 em clone compilado de 1614 a 1735. Não houve chamada Auvo ou OS real; a prova não mede carga nem abrange todos os escritores.
