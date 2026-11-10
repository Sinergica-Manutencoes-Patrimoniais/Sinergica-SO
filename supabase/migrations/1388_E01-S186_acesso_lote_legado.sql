-- ADR-1235: funções mediadas; gates e tabelas permanecem fechados.
grant execute on function pcm.sso_aceitar_previa_lote_legado(uuid,uuid,uuid,jsonb,boolean) to authenticated;
grant execute on function pcm.sso_criar_lote_legado_aceito(uuid,uuid,uuid,uuid) to authenticated;
