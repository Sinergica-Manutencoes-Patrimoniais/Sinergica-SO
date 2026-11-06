-- ADR-1630: serializa revogação antes de conferir acesso, inclusive em replay.
do $patch$
declare
 d text:=pg_catalog.pg_get_functiondef('pcm.sso_conferir_acesso_fila_grupo(uuid,uuid,uuid,text)'::regprocedure);
 trava text:=' if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended(''sso-autorizacao-confirmacao-visita'',0)) then raise exception ''autorizacao_em_alteracao'' using errcode=''55P03''; end if;';
 isolamento text:=' if current_setting(''transaction_isolation'')<>''read committed'' then raise exception ''isolamento_nao_suportado'' using errcode=''25001''; end if;';
begin
 if (length(d)-length(replace(d,trava,'')))/length(trava)<>1 or
    (length(d)-length(replace(d,isolamento,'')))/length(isolamento)<>1 then
  raise exception 'fila_grupo_autorizacao_incompativel' using errcode='55000';
 end if;
 d:=replace(d,trava,'');
 execute replace(d,isolamento,isolamento||E'\n'||trava);
end; $patch$;
