-- ADR-1646: revisão de decisão obsoleta não é serialização transacional.
do $patch$
declare f regprocedure;d text;
 a text:='raise exception ''revisao_decisao_obsoleta'' using errcode=''40001''';
 b text:='raise exception ''revisao_decisao_obsoleta'' using errcode=''P0014''';
begin
 foreach f in array array[
  'pcm.sso_decidir_impacto_ocorrencia(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text)'::regprocedure,
  'pcm.sso_decidir_impacto_visita(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text)'::regprocedure
 ] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'decisao_impacto_incompativel: %',f using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
