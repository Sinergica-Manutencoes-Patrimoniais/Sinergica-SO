-- ADR-1616: revisão da origem é conflito de negócio, não serialização.
do $patch$
declare
 d text:=pg_catalog.pg_get_functiondef('pcm.sso_contexto_origem_rotina(uuid,uuid,uuid,uuid,uuid,integer)'::regprocedure);
 a text:=$old$raise exception 'revisao_obsoleta' using errcode='40001'$old$;
 b text:=$new$raise exception 'revisao_obsoleta' using errcode='P0017'$new$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'contexto_origem_incompativel' using errcode='55000'; end if;
 execute replace(d,a,b);
end; $patch$;
