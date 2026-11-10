-- ADR-1634: conflito de revisão é rejeição de negócio, não falha transacional.
do $patch$
declare f regprocedure; d text; a text:=$a$raise exception 'revisao_obsoleta' using errcode='40001'$a$;
 b text:=$b$raise exception 'revisao_obsoleta' using errcode='P0011'$b$;
begin
 foreach f in array array[
  'pcm.sso_transicionar_plano_preparado(uuid,uuid,integer,text,date,text)'::regprocedure,
  'pcm.sso_retomar_plano_preparado(uuid,uuid,integer,date,text)'::regprocedure
 ] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'transicao_plano_incompativel: %',f using errcode='55000'; end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
