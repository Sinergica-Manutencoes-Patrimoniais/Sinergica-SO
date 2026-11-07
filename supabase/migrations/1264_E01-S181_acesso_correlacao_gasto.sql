-- ADR-1112: concessões preparadas; gate e verificações permanecem obrigatórios.
grant execute on function comercial.sso_declarar_correlacao_gasto(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;
grant execute on function comercial.sso_listar_correlacoes_gasto(uuid,uuid,uuid,uuid,integer) to authenticated;
