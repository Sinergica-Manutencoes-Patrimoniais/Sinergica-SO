-- ADR-0710: funções externas com gates e autorização próprios, ainda desligados.
grant execute on function pcm.sso_prever_visitas_rotina(uuid,uuid,uuid,uuid,date,date,uuid,integer) to authenticated;
grant execute on function pcm.sso_preparar_visita_canonica(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text) to authenticated;
grant execute on function pcm.sso_listar_visitas_integracao_legado(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
grant execute on function pcm.sso_materializar_visita_legado(uuid,uuid,uuid,uuid,uuid,text) to authenticated;
