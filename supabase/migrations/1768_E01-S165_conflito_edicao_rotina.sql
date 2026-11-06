-- ADR-1626: revisão obsoleta não é serialização transitória.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_editar_rotina_rascunho_interno(uuid,integer,uuid,uuid,text,text,uuid,text,integer,text,date,integer,integer,integer,text,uuid,text)'::regprocedure);
 a text:=$a$raise exception 'revisao_obsoleta' using errcode = '40001'$a$;
 b text:=$b$raise exception 'revisao_obsoleta' using errcode = 'P0011'$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'edicao_rotina_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
