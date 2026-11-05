-- ADR-1621: revisão divergente não é serialização transitória.
do $patch$
declare f regprocedure;d text;
 a text:=$a$raise exception 'revisao_obsoleta' using errcode='40001'$a$;
 b text:=$b$raise exception 'revisao_obsoleta' using errcode='P0011'$b$;
begin
 foreach f in array array[
  'pcm.sso_declarar_relacao_plano_legado(uuid,uuid,uuid,uuid,integer,text,text)'::regprocedure,
  'pcm.sso_materializar_lote_legado(uuid,uuid,uuid,uuid,uuid,integer,uuid[],text)'::regprocedure
 ] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'integracao_legada_incompativel: %',f using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
