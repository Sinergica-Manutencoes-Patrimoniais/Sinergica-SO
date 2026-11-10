-- ADR-1612: revisão de fila divergente não é serialização transitória.
do $patch$
declare
 d text:=pg_catalog.pg_get_functiondef('pcm.sso_confirmar_fila_preventiva(uuid,uuid,uuid,uuid,integer,text)'::regprocedure);
 a text:=$a$raise exception 'fila_ou_revisao_indisponivel' using errcode='40001'$a$;
 b text:=$b$raise exception 'fila_ou_revisao_indisponivel' using errcode='P0012'$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'confirmacao_fila_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
 d:=pg_catalog.pg_get_functiondef('pcm.sso_aprovar_excecao_visita(uuid,uuid,uuid,uuid,integer,date,text,text,text)'::regprocedure);
 a:=$a$raise exception 'visita_obsoleta' using errcode='40001'$a$;
 b:=$b$raise exception 'visita_obsoleta' using errcode='P0011'$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'excecao_visita_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
