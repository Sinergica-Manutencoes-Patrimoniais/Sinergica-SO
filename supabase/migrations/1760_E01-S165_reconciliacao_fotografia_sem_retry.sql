-- ADR-1618: fotografia obsoleta é rejeição definitiva.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_reconciliar_legada_sso(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb)'::regprocedure);
 a text:=$a$raise exception 'fotografia_obsoleta' using errcode='40001'$a$;
 b text:=$b$raise exception 'fotografia_obsoleta' using errcode='P0010'$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'reconciliacao_legada_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
