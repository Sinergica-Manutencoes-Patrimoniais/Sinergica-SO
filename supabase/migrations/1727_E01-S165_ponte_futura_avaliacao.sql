-- ADR-1583: elimina bloqueio circular somente para ponte escolhida e ainda sem efeitos.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_legada_resolvida_por_escolha_rascunho(uuid,uuid,uuid,integer,uuid)'::regprocedure);
 a text:=$antes$v_e.decisao is distinct from 'somente_legado'$antes$;
 b text:=$depois$v_e.decisao not in ('somente_legado','integrar_ponte')$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'avaliacao_legada_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
