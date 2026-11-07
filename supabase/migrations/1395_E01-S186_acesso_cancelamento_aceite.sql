-- ADR-1242: acesso autenticado condicionado aos gates e permissões da função.
grant execute on function pcm.sso_cancelar_aceite_lote_legado(uuid,uuid,uuid,uuid,text) to authenticated;
