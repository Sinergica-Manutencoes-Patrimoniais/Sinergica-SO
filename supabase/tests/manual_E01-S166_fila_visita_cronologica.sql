-- Migrations até 1648; executar em banco sintético, dentro de transação revertida.
\ir manual_E01-S166_fila_visita.sql
update config.sso_concessoes set ativa=true where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
set local role authenticated;
do $$ declare r record;begin
 select * into r from pcm.sso_listar_fila_visita_cronologica('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','cancelado',null,null,null,null,20);
 if not found or r.preparada_id<>'16610000-0000-0000-0000-000000000161'::uuid or r.visita_id<>'16610000-0000-0000-0000-000000000081'::uuid then raise exception 'linha_incorreta';end if;
 if exists(select 1 from pcm.sso_listar_fila_visita_cronologica('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','aguardando',null,null,null,null,20)) then raise exception 'filtro_estado_incorreto';end if;
 if exists(select 1 from pcm.sso_listar_fila_visita_cronologica('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',null,null,null,r.vencimento,r.ciclo_id,20)) then raise exception 'cursor_repetido';end if;
 begin perform * from pcm.sso_listar_fila_visita_cronologica('16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000121',null,null,null,null,null,20);raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
end; $$;
reset role;
update config.sso_concessoes set ativa=false where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
set local role authenticated;
do $$ begin begin perform * from pcm.sso_listar_fila_visita_cronologica('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',null,null,null,null,null,20);raise exception 'revogacao_ignorada';exception when insufficient_privilege then null;end;end; $$;
reset role;
do $$ begin if has_function_privilege('anon','pcm.sso_listar_fila_visita_cronologica(uuid,uuid,text,date,date,date,uuid,integer)','execute') then raise exception 'acl_anon_indevida';end if;end; $$;
