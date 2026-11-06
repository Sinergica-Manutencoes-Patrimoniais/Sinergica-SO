-- Clone descartável, executar em BEGIN/ROLLBACK.
\ir manual_E01-S166_vincular_serie_1778.sql
set local role authenticated;
do $$ declare a jsonb;b jsonb;n integer; begin
 a:=pcm.sso_decidir_vigencia_serie_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','17990000-0000-4000-8000-000000000001','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062','17990000-0000-4000-8000-000000000002',0,'criar',current_date,'fixture');
 b:=pcm.sso_decidir_vigencia_serie_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','17990000-0000-4000-8000-000000000001','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062','17990000-0000-4000-8000-000000000002',0,'criar',current_date,'fixture');
 if a is distinct from b then raise exception 'replay_divergente';end if;
 begin perform pcm.sso_decidir_vigencia_serie_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','17990000-0000-4000-8000-000000000003','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062','17990000-0000-4000-8000-000000000002',99,'encerrar',current_date,'fixture');raise exception 'revisao_obsoleta_aceita';exception when sqlstate 'P0011' then if sqlerrm<>'revisao_obsoleta' then raise;end if;end;
 select count(*) into n from pcm.sso_listar_vigencias_serie_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062',null,30);
 if n<>1 then raise exception 'vigencia_nao_listada';end if;
 select count(*) into n from pcm.sso_listar_eventos_vigencia_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17990000-0000-4000-8000-000000000002',null,30);
 if n<>1 then raise exception 'evento_nao_listado';end if;
 begin perform * from pcm.sso_listar_vigencias_serie_mediada('16610000-0000-0000-0000-000000000002','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000062',null,30);raise exception 'ator_aceito';exception when insufficient_privilege then null;end;
 begin perform * from pcm.sso_listar_eventos_vigencia_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000121','17990000-0000-4000-8000-000000000002',null,30);raise exception 'cliente_aceito';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin if has_function_privilege('anon','pcm.sso_decidir_vigencia_serie_mediada(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text,date,text)','execute') or has_function_privilege('authenticated','pcm.sso_decidir_vigencia_rotina_serie(uuid,uuid,uuid,uuid,uuid,integer,text,date,text)','execute') then raise exception 'acl_indevida';end if;end $$;
