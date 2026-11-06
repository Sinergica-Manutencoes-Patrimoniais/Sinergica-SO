-- ADR-1629: transações de Rotina não cruzam revogação de concessões.
create function pcm.sso_serializar_autorizacao_rotina() returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03';end if;
end; $$;
revoke all on function pcm.sso_serializar_autorizacao_rotina() from public,anon,authenticated,service_role;
do $patch$
declare f regprocedure;d text;a text:=E'\nbegin\n';b text:=E'\nbegin\n  perform pcm.sso_serializar_autorizacao_rotina();\n';
begin
 foreach f in array array[
 'pcm.sso_editar_rotina_rascunho_interno(uuid,integer,uuid,uuid,text,text,uuid,text,integer,text,date,integer,integer,integer,text,uuid,text)'::regprocedure,
 'pcm.sso_adicionar_rotina_rascunho_interno(uuid,integer,uuid,uuid,text,text,uuid,text,integer,text,date,integer,integer,integer,text,uuid,text,boolean)'::regprocedure,
 'pcm.sso_retirar_rotina_rascunho(uuid,integer,uuid,uuid,text)'::regprocedure] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'autorizacao_rotina_incompativel: %',f using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
