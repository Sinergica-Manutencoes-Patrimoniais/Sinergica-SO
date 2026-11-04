-- ADR-1122: função mediada; gate e capacidades permanecem obrigatórios.
grant execute on function comercial.sso_retificar_fonte_utilizada(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text,bigint,text) to authenticated;
