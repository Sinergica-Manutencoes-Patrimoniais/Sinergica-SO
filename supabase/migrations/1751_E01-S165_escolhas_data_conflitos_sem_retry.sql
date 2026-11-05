-- ADR-1609: rejeições de negócio explícitas nas escolhas de nova data.
do $patch$
declare f regprocedure; d text; a text; b text;
begin
 f:='pcm.sso_prever_novas_datas_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb)'::regprocedure;
 d:=pg_catalog.pg_get_functiondef(f); a:=$old$raise exception 'revisao_obsoleta' using errcode='40001'$old$; b:=$new$raise exception 'revisao_obsoleta' using errcode='P0011'$new$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'previa_data_incompativel' using errcode='55000'; end if; execute replace(d,a,b);
 f:='pcm.sso_consultar_nova_data_calendario(uuid,uuid,uuid,uuid,uuid,integer,integer)'::regprocedure;
 d:=pg_catalog.pg_get_functiondef(f);
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'consulta_data_incompativel' using errcode='55000'; end if; d:=replace(d,a,b);
 a:=$old$raise exception 'decisao_obsoleta' using errcode='40001'$old$; b:=$new$raise exception 'decisao_obsoleta' using errcode='P0014'$new$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'consulta_decisao_incompativel' using errcode='55000'; end if; execute replace(d,a,b);
 f:='pcm.sso_escolher_nova_visita(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,uuid,date,text,text,jsonb)'::regprocedure;
 d:=pg_catalog.pg_get_functiondef(f); a:=$old$raise exception 'revisao_obsoleta' using errcode='40001'$old$; b:=$new$raise exception 'revisao_obsoleta' using errcode='P0011'$new$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'escolha_visita_revisao_incompativel' using errcode='55000'; end if; d:=replace(d,a,b);
 a:=$old$raise exception 'data_candidata_alterada' using errcode='40001'$old$; b:=$new$raise exception 'data_candidata_alterada' using errcode='P0014'$new$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'escolha_visita_data_incompativel' using errcode='55000'; end if; execute replace(d,a,b);
end; $patch$;
