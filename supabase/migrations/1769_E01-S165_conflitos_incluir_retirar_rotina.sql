-- ADR-1627: revisão divergente é conflito de negócio.
do $patch$
declare f regprocedure;d text;
 a text:=$a$raise exception 'revisao_obsoleta' using errcode = '40001'$a$;
 b text:=$b$raise exception 'revisao_obsoleta' using errcode = 'P0011'$b$;
begin
 foreach f in array array[
 'pcm.sso_adicionar_rotina_rascunho_interno(uuid,integer,uuid,uuid,text,text,uuid,text,integer,text,date,integer,integer,integer,text,uuid,text,boolean)'::regprocedure,
 'pcm.sso_retirar_rotina_rascunho(uuid,integer,uuid,uuid,text)'::regprocedure] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'incluir_retirar_incompativel: %',f using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
