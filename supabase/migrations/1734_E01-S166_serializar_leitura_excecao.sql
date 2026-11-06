-- ADR-1592: histórico usa o mesmo protocolo de revogação da escrita.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_consultar_excecao_visita(uuid,uuid,uuid)'::regprocedure);
 a text:=$antes$begin
 if auth.uid() is null$antes$;
 b text:=$depois$begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03';end if;
 if auth.uid() is null$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'consulta_excecao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
