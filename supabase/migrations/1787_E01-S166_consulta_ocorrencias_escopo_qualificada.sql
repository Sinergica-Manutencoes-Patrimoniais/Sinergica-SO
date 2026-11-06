-- ADR-1645: a consulta retorna coluna id; qualificar gate evita ambiguidade PL/pgSQL.
do $patch$
declare
 d text:=pg_catalog.pg_get_functiondef('pcm.sso_listar_ocorrencias_escopo(uuid,uuid,uuid,uuid,uuid,integer)'::regprocedure);
 a text:='from pcm.sso_escopo_preventivo_gate where id';
 b text:='from pcm.sso_escopo_preventivo_gate g where g.id';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then
  raise exception 'consulta_escopo_incompativel' using errcode='55000';
 end if;
 execute replace(d,a,b);
end; $patch$;
