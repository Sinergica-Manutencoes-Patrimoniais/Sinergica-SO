-- ADR-1608: fotografia e revisão divergentes são conflitos definitivos.
do $patch$
declare f regprocedure; d text; a text; b text;
begin
 f:='pcm.sso_declarar_fila_grupo_base_1679(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text)'::regprocedure;
 d:=pg_catalog.pg_get_functiondef(f);
 a:=$a$raise exception 'fotografia_ou_fila_alterada' using errcode='40001'$a$;
 b:=$b$raise exception 'fotografia_ou_fila_alterada' using errcode='P0010'$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'declaracao_fila_grupo_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
 f:='pcm.sso_reabrir_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text)'::regprocedure;
 d:=pg_catalog.pg_get_functiondef(f);
 a:=$a$raise exception 'fila_ou_revisao_indisponivel' using errcode='40001'$a$;
 b:=$b$raise exception 'fila_ou_revisao_indisponivel' using errcode='P0012'$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'reabertura_fila_grupo_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
