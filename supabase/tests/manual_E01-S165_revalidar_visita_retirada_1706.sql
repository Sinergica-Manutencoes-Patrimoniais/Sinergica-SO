-- Executar em clone com BEGIN/ROLLBACK; setup simula 1045 e data civil.
\ir manual_E01-S165_aprovacao_nova_visita_1703.sql
reset role;
do $$ declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_data_civil_versao_geracao(uuid,uuid)'::regprocedure);a text:=$a$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date;$a$;b text:=$b$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date+1;$b$;begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'relogio_fixture_incompativel';end if;execute replace(d,a,b);
end; $$;
insert into pcm.feriados_declarados(id,cliente_id,data,fonte,motivo,criado_por)
select '16610000-0000-0000-0000-000000000270',cliente_id,vencimento_novo,'fixture','feriado posterior à aprovação','16610000-0000-0000-0000-000000000001' from pcm.sso_escolhas_nova_data_visita where request_id='16610000-0000-0000-0000-000000000231';
set local role authenticated;
do $$ declare r jsonb;begin
 r:=pcm.sso_aplicar_retiradas_fila('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000271','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',50,null,null);
 if (r->>'canceladas')::integer<>0 or (r->>'pendentesConferencia')::integer<1 then raise exception 'feriado_nao_preservou_fila: %',r;end if;
end; $$;
reset role;
do $$ begin if (select estado from pcm.sso_fila_visita where preparada_id='16610000-0000-0000-0000-000000000161')='cancelado' then raise exception 'fila_cancelada_com_feriado';end if;end; $$;
delete from pcm.feriados_declarados where id='16610000-0000-0000-0000-000000000270';
-- Revisão sintética da candidata posterior ao selo, sem alterar sua identidade.
set local session_replication_role=replica;
update pcm.visitas set revisao=revisao+1 where id=(select visita_id from pcm.sso_escolhas_nova_data_visita where request_id='16610000-0000-0000-0000-000000000231');
set local session_replication_role=origin;
set local role authenticated;
do $$ declare r jsonb;begin
 r:=pcm.sso_aplicar_retiradas_fila('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000272','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',50,null,null);
 if (r->>'canceladas')::integer<>0 or (r->>'pendentesConferencia')::integer<1 then raise exception 'mudanca_nao_preservou_fila: %',r;end if;
end; $$;
reset role;
do $$ begin if (select estado from pcm.sso_fila_visita where preparada_id='16610000-0000-0000-0000-000000000161')='cancelado' then raise exception 'fila_cancelada_com_candidata_alterada';end if;end; $$;
