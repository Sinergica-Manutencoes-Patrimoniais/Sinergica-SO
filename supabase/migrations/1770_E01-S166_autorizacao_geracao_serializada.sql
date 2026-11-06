-- ADR-1628: a revogação não pode cruzar a geração nem o replay.
create function pcm.sso_serializar_autorizacao_geracao() returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03';end if;
end; $$;
revoke all on function pcm.sso_serializar_autorizacao_geracao() from public,anon,authenticated,service_role;
do $patch$
declare f regprocedure;d text;a text:=E'\nbegin\n';b text:=E'\nbegin\n perform pcm.sso_serializar_autorizacao_geracao();\n';
begin
 foreach f in array array[
 'pcm.sso_guardar_ordem_ciclo(uuid)'::regprocedure,
 'pcm.sso_preparar_visita_canonica(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text)'::regprocedure,
 'pcm.sso_preparar_ocorrencia_por_visita(uuid,uuid,uuid,uuid,uuid,uuid,integer,text)'::regprocedure,
 'pcm.sso_preparar_lote_visita_canonica(uuid,uuid,uuid,uuid,uuid,integer,jsonb)'::regprocedure] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'geracao_autorizacao_incompativel: %',f using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
