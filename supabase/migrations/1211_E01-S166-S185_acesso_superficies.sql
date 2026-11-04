-- ADR-1062: permissões para telas preparadas; gates permanecem fechados.
grant execute on function pcm.sso_observar_fila_reconciliacao(uuid,uuid,uuid,uuid[]) to authenticated;
grant execute on function pcm.sso_listar_observacoes_fila(uuid,uuid,uuid,integer,integer) to authenticated;
grant execute on function pcm.sso_prever_mudanca_dia(uuid,uuid,uuid,integer,date,integer,date,uuid,integer) to authenticated;
grant execute on function pcm.sso_listar_ocorrencias_impacto_dia(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
