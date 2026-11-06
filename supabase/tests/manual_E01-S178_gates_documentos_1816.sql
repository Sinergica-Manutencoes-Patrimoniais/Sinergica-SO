-- Apenas clone descartável com 1816; a fixture seguinte cobre acesso e Cliente.
begin;
do $$
declare d text := pg_catalog.pg_get_functiondef('pcm.sso_listar_documentos_staging_ativo(text,uuid,uuid,integer)'::regprocedure);
begin
 if position('select g.habilitado from pcm.sso_documento_staging_ativo_gate g where g.id' in d)=0
  or position('select g.habilitado from pcm.sso_documentos_levantamento_gate g where g.id' in d)=0
  or has_function_privilege('authenticated','pcm.sso_listar_documentos_staging_ativo(text,uuid,uuid,integer)','execute')
  or has_function_privilege('anon','pcm.sso_listar_documentos_staging_ativo(text,uuid,uuid,integer)','execute') then
  raise exception 'nucleo_documentos_incompativel';
 end if;
end $$;
rollback;
\ir manual_E01-S178_documento_mediado_1812.sql
