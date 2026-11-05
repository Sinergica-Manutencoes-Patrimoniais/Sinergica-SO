-- Somente clone descartável com migrations até 1812. Não prova Storage HTTP.
begin;
do $$ begin
 if (select habilitado from pcm.sso_documento_ativo_mediado_gate where id) is distinct from false then raise exception 'gate_inicial_invalido'; end if;
 if not has_function_privilege('authenticated','pcm.sso_listar_documentos_ativo_mediado(text,uuid,uuid,integer)','execute')
   or has_function_privilege('anon','pcm.sso_listar_documentos_ativo_mediado(text,uuid,uuid,integer)','execute')
   or has_function_privilege('authenticated','pcm.sso_listar_documentos_staging_ativo(text,uuid,uuid,integer)','execute')
   or not has_function_privilege('authenticated','pcm.sso_autorizar_documento_ativo_mediado(uuid,uuid)','execute')
   or has_function_privilege('anon','pcm.sso_autorizar_documento_ativo_mediado(uuid,uuid)','execute')
   or has_function_privilege('authenticated','pcm.sso_localizar_documento_ativo_servico(uuid)','execute')
   or has_function_privilege('anon','pcm.sso_localizar_documento_ativo_servico(uuid)','execute')
   or not has_function_privilege('service_role','pcm.sso_localizar_documento_ativo_servico(uuid)','execute')
   or has_function_privilege('authenticated','pcm.sso_caminho_documento_staging_ativo(uuid)','execute') then
   raise exception 'acl_invalida'; end if;
end $$;
set local role authenticated;
set local request.jwt.claims='{"sub":"18120000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
do $$ begin
 begin
  perform pcm.sso_autorizar_documento_ativo_mediado('18120000-0000-4000-8000-000000000002','18120000-0000-4000-8000-000000000003');
  raise exception 'ator_divergente_aceito';
 exception when insufficient_privilege then null; end;
 begin
  perform pcm.sso_autorizar_documento_ativo_mediado('18120000-0000-4000-8000-000000000001','18120000-0000-4000-8000-000000000003');
  raise exception 'gate_fechado_aceito';
 exception when sqlstate '55000' then null; end;
 begin
  perform * from pcm.sso_listar_documentos_ativo_mediado('sistema','18120000-0000-4000-8000-000000000003',null,20);
  raise exception 'listagem_gate_fechado_aceita';
 exception when sqlstate '55000' then null; end;
end $$;
reset role;
rollback;
