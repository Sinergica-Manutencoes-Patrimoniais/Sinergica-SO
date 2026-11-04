-- ADR-1084: gates e autorização continuam obrigatórios; não concede acesso às tabelas.
grant execute on function pcm.sso_copiar_rotina_modelo(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,uuid,integer,uuid,text,uuid) to authenticated;
grant execute on function pcm.sso_proveniencia_rotina_modelo(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function pcm.sso_consultar_conferencia_copia(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function pcm.sso_conferir_rotina_copiada(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
