-- ADR-1604: conflito de revisão não é erro de serialização transitória.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_aprovar_revisao_preparada(uuid,integer,uuid,date)'::regprocedure);
 a text:=$a$raise exception 'revisao_obsoleta' using errcode = '40001'$a$;
 b text:=$b$raise exception 'revisao_obsoleta' using errcode = 'P0011'$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'aprovacao_revisao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
