-- Clone sintético; executar em BEGIN/ROLLBACK.
\ir manual_E01-S166_fila_visita_fixture.sql
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 begin perform pcm.sso_vincular_serie_rotina_mediado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000197','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062',999);raise exception 'revisao_obsoleta_aceita';exception when sqlstate 'P0011' then if sqlerrm<>'revisao_obsoleta' then raise;end if;end;
 a:=pcm.sso_vincular_serie_rotina_mediado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000198','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062',1);
 b:=pcm.sso_vincular_serie_rotina_mediado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000198','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062',1);
 if a is distinct from b then raise exception 'replay_divergente';end if;
 begin perform pcm.sso_vincular_serie_rotina_mediado('16610000-0000-0000-0000-000000000002','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000198','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062',1);raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;
 begin perform pcm.sso_vincular_serie_rotina_mediado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000198','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062',1);raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','pcm.sso_vincular_serie_rotina_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer)','execute') or has_function_privilege('authenticated','pcm.sso_vincular_rotina_serie_preparado(uuid,uuid,uuid,uuid,uuid,integer)','execute') then raise exception 'acl_indevida';end if;
end $$;
