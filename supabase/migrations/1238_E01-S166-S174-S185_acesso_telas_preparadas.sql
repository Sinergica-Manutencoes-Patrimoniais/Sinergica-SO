-- ADR-1087: concessão para usuários autenticados; gates existentes permanecem fechados.
grant execute on function pcm.sso_alterar_dia_com_visitas(uuid,uuid,uuid,uuid,uuid,integer,integer,date,jsonb) to authenticated;
grant execute on function pcm.sso_consultar_reconciliacao_ciclo_os(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function pcm.sso_observar_os_reconciliacao(uuid,uuid,uuid,uuid[]) to authenticated;
grant execute on function pcm.sso_listar_observacoes_os(uuid,uuid,uuid,integer,integer) to authenticated;
