-- Clone descartável, executar em transação revertida.
\ir manual_E01-S166_fila_visita_fixture.sql
set local role authenticated;
do $$ declare n integer;begin
 select count(*) into n from pcm.sso_listar_series_rotina_mediado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000123',null,50);
 if n<>1 then raise exception 'serie_nao_listada';end if;
 begin perform * from pcm.sso_listar_series_rotina_mediado('16610000-0000-0000-0000-000000000002','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000123',null,50);raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;
 begin perform * from pcm.sso_listar_series_rotina_mediado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000123',null,50);raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','pcm.sso_listar_series_rotina_mediado(uuid,uuid,uuid,uuid,uuid,integer)','execute') or has_function_privilege('authenticated','pcm.sso_listar_vinculos_rotina_serie(uuid,uuid,uuid,integer)','execute') then raise exception 'acl_indevida';end if;
end $$;
