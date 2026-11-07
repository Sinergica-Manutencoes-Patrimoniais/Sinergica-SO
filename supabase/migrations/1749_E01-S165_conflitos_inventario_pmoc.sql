-- ADR-1607: conflitos conhecidos não são erros transitórios de serialização.
do $patch$
declare f regprocedure;d text;a text;b text;r record;
begin
 for f in select unnest(array[
 'pcm.sso_listar_inventario_pmoc_revisao(uuid,uuid,uuid,integer,uuid,integer)'::regprocedure,
 'pcm.sso_classificar_pmoc_revisao(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb)'::regprocedure,
 'pcm.sso_avaliar_inventario_pmoc(uuid,uuid,uuid,integer,date)'::regprocedure]) loop
  d:=pg_catalog.pg_get_functiondef(f);
  for r in select * from (values ('revisao_obsoleta','P0011'),('fotografia_pmoc_alterada','P0013'),('revisao_decisao_obsoleta','P0014')) as x(msg,codigo) loop
   a:=format('raise exception %L using errcode=%L',r.msg,'40001');b:=format('raise exception %L using errcode=%L',r.msg,r.codigo);
   if position(a in d)>0 then d:=replace(d,a,b);end if;
  end loop;
  if position('raise exception ''revisao_obsoleta'' using errcode=''P0011''' in d)=0 then raise exception 'inventario_pmoc_incompativel: %',f using errcode='55000';end if;
  execute d;
 end loop;
end; $patch$;
