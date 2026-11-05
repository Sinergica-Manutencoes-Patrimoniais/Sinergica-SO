# Conflito de revisão da fila por HTTP

Em stack descartável e rede isolada, preparar `manual_E01-S166_fila_visita_fixture.sql`, habilitar o gate da fila no clone e autenticar o ator sintético no Auth de ensaio. Chamar diretamente o PostgREST, sem proxy, em `sso_alterar_fila_visita` com ação `cancelar`, preparada da fixture e revisão 999, sem linha de fila correspondente.

Antes da 1747, a chamada atingiu timeout após seis segundos. Com a 1747, respondeu em 5 ms com HTTP 500 e corpo `code=P0012`, `message=fila_ou_revisao_indisponivel`. O teste SQL `manual_E01-S166_fila_visita_conflito_1747.sql` cobre conflito e replay de inclusão. Reverter transações e remover os ambientes descartáveis; não usar dados reais ou Auvo.
