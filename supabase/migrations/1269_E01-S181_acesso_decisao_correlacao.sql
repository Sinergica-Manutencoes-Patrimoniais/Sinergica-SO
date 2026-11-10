-- ADR-1115: somente funções mediadas; ambos gates permanecem fechados.
grant execute on function comercial.sso_decidir_correlacao_gasto(uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
grant execute on function comercial.sso_listar_correlacoes_gasto_v2(uuid,uuid,uuid,uuid,integer) to authenticated;
