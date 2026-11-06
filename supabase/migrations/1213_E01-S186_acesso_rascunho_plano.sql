-- ADR-1065: acesso autenticado às superfícies; gates continuam fechados.
grant execute on function pcm.sso_consultar_fotografia_plano_legado(uuid,uuid,uuid) to authenticated;
grant execute on function pcm.sso_criar_rascunho_plano_legado(uuid,uuid,uuid,uuid,uuid,jsonb,text,integer,text,date,integer,integer) to authenticated;
