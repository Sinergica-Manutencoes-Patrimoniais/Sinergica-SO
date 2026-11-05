-- ADR-0707: apenas as RPCs externas; gates e autorização permanecem fechados.
grant execute on function pcm.sso_preparar_lote_visita_canonica(uuid,uuid,uuid,uuid,uuid,integer,jsonb) to authenticated;
grant execute on function pcm.sso_materializar_lote_visita_legado(uuid,uuid,uuid,uuid,uuid,jsonb,text) to authenticated;
