-- ADR-1603: comparação obsoleta em prévia é conflito definitivo.
do $patch$
declare
 f regprocedure;
 d text;
 a text := $old$raise exception 'comparacao_obsoleta' using errcode='40001'$old$;
 b text := $new$raise exception 'comparacao_obsoleta' using errcode='P0010'$new$;
begin
 foreach f in array array[
  'pcm.sso_prever_novas_datas_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb)'::regprocedure,
  'pcm.sso_listar_candidatas_nova_visita(uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb)'::regprocedure
 ] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
   raise exception 'previa_comparacao_incompativel: %',f using errcode='55000';
  end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
