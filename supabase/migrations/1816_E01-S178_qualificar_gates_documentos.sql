-- ADR-1675: altera somente referências inequívocas aos gates do núcleo privado.
do $migration$
declare
 f regprocedure := 'pcm.sso_listar_documentos_staging_ativo(text,uuid,uuid,integer)'::regprocedure;
 d text := pg_catalog.pg_get_functiondef(f);
 a text := 'select habilitado from pcm.sso_documento_staging_ativo_gate where id';
 b text := 'select g.habilitado from pcm.sso_documento_staging_ativo_gate g where g.id';
 c text := 'select habilitado from pcm.sso_documentos_levantamento_gate where id';
 e text := 'select g.habilitado from pcm.sso_documentos_levantamento_gate g where g.id';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  or (length(d)-length(replace(d,c,'')))/length(c)<>1 then
  raise exception 'listagem_documentos_incompativel' using errcode='55000';
 end if;
 execute replace(replace(d,a,b),c,e);
end;
$migration$;
