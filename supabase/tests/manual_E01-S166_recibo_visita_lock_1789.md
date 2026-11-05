# Recibo anterior: disputa por request

Executar somente em clone descartável com migrations até 1789. Preparar os dados sintéticos de `manual_E01-S166_fila_visita_fixture.sql` em transação confirmada no clone e localizar, como administrador, o único registro de `pcm.calendario_contratual_comandos` cujo payload tem `tipo = 'prepararOcorrenciaVisita'` para o Cliente da fixture. Usar exclusivamente seus valores sintéticos nesta sequência; não usar dados reais. Antes do ensaio anotar contagens de ocorrências preparadas, comandos, OS, outbox e auditoria.

1. Na sessão A, iniciar `BEGIN` e adquirir `pg_advisory_xact_lock(hashtextextended('calendario-request:' || <request_id>::text, 0))`, mantendo a transação aberta.
2. Na sessão B, iniciar `BEGIN`, configurar os claims da fixture e `SET LOCAL ROLE authenticated`. Chamar `pcm.sso_consultar_recibo_preparacao_visita_anterior` com ator, Cliente e todos os campos do payload original. Esperado: `55P03 pedido_em_processamento`; reverter B.
3. Reverter A. Em nova transação READ COMMITTED da sessão B, repetir a consulta idêntica; esperar `encontrado=true` e o recibo original. Repetir novamente e comparar os resultados. Não chamar comando de preparação.
4. Comparar as contagens anotadas: a consulta não pode criar ocorrência, comando, OS, outbox ou evento. Remover apenas o clone do ensaio.

Uma resposta `encontrado=false` significa apenas ausência observada. Uma requisição antiga ainda pode chegar depois; a interface deve manter o pedido. Esta sequência não prova a inexistência de requisições em trânsito nem substitui homologação.
