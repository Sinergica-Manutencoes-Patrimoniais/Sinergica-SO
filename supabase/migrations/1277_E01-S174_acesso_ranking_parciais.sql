-- ADR-1120: entrada mediada; gates e capacidades continuam obrigatórios.
grant execute on function pcm.sso_ranking_backlog_com_parciais(uuid,uuid,integer,text,uuid,text,text) to authenticated;
