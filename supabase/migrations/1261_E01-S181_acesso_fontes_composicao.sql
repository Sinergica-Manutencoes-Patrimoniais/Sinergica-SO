-- ADR-1109: gates e validações de capacidade permanecem obrigatórios.
grant execute on function comercial.sso_declarar_fonte_aquisicao(uuid,uuid,uuid,uuid,uuid,integer,text,text,bigint) to authenticated;
grant execute on function comercial.sso_listar_fontes_aquisicao(uuid,uuid,uuid,uuid,integer) to authenticated;
grant execute on function comercial.sso_retificar_fonte_aquisicao(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text,bigint,text) to authenticated;
grant execute on function comercial.sso_preparar_orcamento_misto(uuid,uuid,uuid,uuid,integer,uuid,integer,text,uuid[],jsonb,numeric,bigint) to authenticated;
grant execute on function comercial.sso_listar_fontes_composicao_mista(uuid,uuid,uuid,integer,uuid,integer) to authenticated;
