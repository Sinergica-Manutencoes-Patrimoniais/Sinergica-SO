-- ADR-1617: conflitos conhecidos não são serialização transitória.
do $patch$
declare f regprocedure;d text;a text:=$a$raise exception 'revisao_obsoleta' using errcode='40001'$a$;b text:=$b$raise exception 'revisao_obsoleta' using errcode='P0011'$b$;
begin
 foreach f in array array['pcm.sso_conferir_diagnostico_revisao(uuid,uuid,uuid,integer,text)'::regprocedure,'pcm.sso_registrar_precondicao_impactos(uuid,uuid,uuid,integer,date)'::regprocedure] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'diagnostico_precondicao_incompativel: %',f using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
