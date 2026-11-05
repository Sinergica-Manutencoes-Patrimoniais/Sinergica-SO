-- ADR-0711: apenas RPCs externas; gates privados permanecem desligados.
grant execute on function pcm.sso_proximo_ciclo_ancorado(uuid,uuid,uuid,uuid,integer) to authenticated;
grant execute on function pcm.sso_historico_ciclo_canonico(uuid,uuid,uuid,uuid,integer,integer,integer) to authenticated;
grant execute on function pcm.sso_listar_feriados_ciclo(uuid,uuid,uuid,uuid,integer) to authenticated;
grant execute on function pcm.sso_decidir_feriado_calendario(uuid,uuid,uuid,uuid,integer,text) to authenticated;
grant execute on function pcm.sso_listar_candidatos_atraso(uuid,uuid,uuid,date,uuid,integer) to authenticated;
grant execute on function pcm.sso_triar_ciclo_atrasado(uuid,uuid,uuid,integer,date,text,text) to authenticated;
grant execute on function pcm.sso_materializar_ciclo_canonico(uuid,uuid,uuid,uuid,uuid,integer,date) to authenticated;
grant execute on function pcm.sso_materializar_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date) to authenticated;
