-- ADR-1611: somente conflitos nomeados e definidos pelas regras de negócio.
do $patch$
declare f regprocedure;d text;a text;b text;
begin
 f:='pcm.sso_comparar_rotina_impacto(uuid,uuid,uuid,integer,uuid,uuid,text)'::regprocedure;
 d:=pg_catalog.pg_get_functiondef(f);a:=$a$raise exception 'revisao_obsoleta' using errcode='40001'$a$;b:=$b$raise exception 'revisao_obsoleta' using errcode='P0011'$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'comparacao_impacto_incompativel' using errcode='55000';end if;execute replace(d,a,b);
 f:='pcm.sso_aplicar_retiradas_fila(uuid,uuid,uuid,uuid,integer,text,uuid)'::regprocedure;
 d:=pg_catalog.pg_get_functiondef(f);a:=$a$raise exception 'fila_alterada' using errcode='40001'$a$;b:=$b$raise exception 'fila_alterada' using errcode='P0012'$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'retirada_impacto_incompativel' using errcode='55000';end if;execute replace(d,a,b);
end; $patch$;
