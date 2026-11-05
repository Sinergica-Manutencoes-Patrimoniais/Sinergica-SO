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

-- Origem sintética construída com FKs e gatilhos ativos; nenhum serviço externo.
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('18120000-0000-4000-8000-000000000011','00000000-0000-0000-0000-000000000000','authenticated','authenticated','documento-a@example.test','', '{}','{}',now(),now()),
 ('18120000-0000-4000-8000-000000000012','00000000-0000-0000-0000-000000000000','authenticated','authenticated','documento-b@example.test','', '{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('18120000-0000-4000-8000-000000000011','colaborador','Ator A',true),
 ('18120000-0000-4000-8000-000000000012','colaborador','Ator B',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values
 ('18120000-0000-4000-8000-000000000011','pcm','leitura'),
 ('18120000-0000-4000-8000-000000000012','pcm','leitura');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('18120000-0000-4000-8000-000000000021','Cliente A',true,'18120000-0000-4000-8000-000000000011'),
 ('18120000-0000-4000-8000-000000000022','Cliente B',true,'18120000-0000-4000-8000-000000000012');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('18120000-0000-4000-8000-000000000011','cadastro.ler','18120000-0000-4000-8000-000000000021'),
 ('18120000-0000-4000-8000-000000000012','cadastro.ler','18120000-0000-4000-8000-000000000022');
insert into pcm.sistemas(id,cliente_id,nome) values ('18120000-0000-4000-8000-000000000031','18120000-0000-4000-8000-000000000021','Sistema A');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por) values ('18120000-0000-4000-8000-000000000041','18120000-0000-4000-8000-000000000021','planilha','fixture-1812','{}','18120000-0000-4000-8000-000000000011');
insert into pcm.sso_levantamento_linhas(lote_id,chave,tipo,atributos) values ('18120000-0000-4000-8000-000000000041','linha','sistema','{}');
insert into storage.objects(id,bucket_id,name,owner_id) values ('18120000-0000-4000-8000-000000000051','sso-levantamento-documentos','18120000-0000-4000-8000-000000000021/18120000-0000-4000-8000-000000000041/18120000-0000-4000-8000-000000000051','18120000-0000-4000-8000-000000000011');
insert into pcm.sso_documentos_levantamento(id,cliente_id,lote_id,linha_chave,objeto_id,titulo,ator_id,request_id) values ('18120000-0000-4000-8000-000000000061','18120000-0000-4000-8000-000000000021','18120000-0000-4000-8000-000000000041','linha','18120000-0000-4000-8000-000000000051','Manual sintético','18120000-0000-4000-8000-000000000011','18120000-0000-4000-8000-000000000071');
insert into pcm.sso_decisoes_documento_levantamento(documento_id,revisao,decisao,motivo,ator_id,request_id) values ('18120000-0000-4000-8000-000000000061',1,'aceito','Aceite sintético','18120000-0000-4000-8000-000000000011','18120000-0000-4000-8000-000000000072');
insert into pcm.sso_documento_staging_ativo(id,documento_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values ('18120000-0000-4000-8000-000000000081','18120000-0000-4000-8000-000000000061','sistema','18120000-0000-4000-8000-000000000031','18120000-0000-4000-8000-000000000021',1,'18120000-0000-4000-8000-000000000011','18120000-0000-4000-8000-000000000073');
update pcm.sso_documento_ativo_mediado_gate set habilitado=true where id;
update pcm.sso_documento_staging_ativo_gate set habilitado=true where id;
update pcm.sso_documentos_levantamento_gate set habilitado=true where id;
set local role authenticated;
set local request.jwt.claims='{"sub":"18120000-0000-4000-8000-000000000011","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
do $$ declare v jsonb; begin
 v:=pcm.sso_autorizar_documento_ativo_mediado('18120000-0000-4000-8000-000000000011','18120000-0000-4000-8000-000000000081');
 if v->>'clienteId'<>'18120000-0000-4000-8000-000000000021' or v->>'documentoId'<>'18120000-0000-4000-8000-000000000061' or v->>'objetoId'<>'18120000-0000-4000-8000-000000000051' or v ? 'caminho' then raise exception 'autorizacao_divergente'; end if;
 if (select count(*) from pcm.sso_listar_documentos_ativo_mediado('sistema','18120000-0000-4000-8000-000000000031',null,20) where id='18120000-0000-4000-8000-000000000081') <> 1 then raise exception 'listagem_permitida_divergente'; end if;
end $$;
set local request.jwt.claims='{"sub":"18120000-0000-4000-8000-000000000012","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
do $$ begin
 begin
  perform pcm.sso_autorizar_documento_ativo_mediado('18120000-0000-4000-8000-000000000012','18120000-0000-4000-8000-000000000081');
  raise exception 'outro_cliente_autorizado';
 exception when insufficient_privilege then null; end;
 begin
  perform * from pcm.sso_listar_documentos_ativo_mediado('sistema','18120000-0000-4000-8000-000000000031',null,20);
  raise exception 'listagem_outro_cliente_autorizada';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
