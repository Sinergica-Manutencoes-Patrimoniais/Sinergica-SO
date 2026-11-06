# Conflito de reabertura de Grupo por HTTP

Usar stack isolada com Auth, PostgREST e dados sintéticos. Preparar `manual_E01-S166_grupo_fila_afirmacao.sql`, autenticar o ator sintético e chamar diretamente `sso_reabrir_fila_grupo` com a preparada da fixture e revisão 999.

Antes da 1750, a chamada atingiu timeout após seis segundos. Após aplicá-la, retornou em 5 ms com HTTP 500 e corpo `code=P0012`, `message=fila_ou_revisao_indisponivel`. As fixtures SQL `manual_E01-S166_reabrir_grupo_fila.sql` e `manual_E01-S166_fila_grupo_conflitos_1750.sql` cobrem também replay e fotografia divergente.

O ensaio HTTP cobre a reabertura de Calendário; a declaração foi validada em SQL. Descartar a stack e não usar dados reais ou Auvo.
