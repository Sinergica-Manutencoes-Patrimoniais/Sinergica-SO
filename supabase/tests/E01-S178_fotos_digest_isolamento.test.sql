-- Dados sintéticos; migration temporária e rollback. Sem upload ou rede.
begin;
set local app.auvo_sync_write='true';
select plan(18);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('17900000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','digest-isolamento@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17900000-0000-0000-0000-000000000001','colaborador','Isolamento foto',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17900000-0000-0000-0000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('17900000-0000-0000-0000-00000000000a','Cliente isolamento',true,'17900000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17900000-0000-0000-0000-000000000001','cadastro.aprovar','17900000-0000-0000-0000-00000000000a');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17900000-0000-0000-0000-000000000001','cadastro.ler','17900000-0000-0000-0000-00000000000a');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por) values ('17900000-0000-0000-0000-000000000021','17900000-0000-0000-0000-00000000000a','manual','isolamento-foto','[]','17900000-0000-0000-0000-000000000001');
insert into pcm.sso_levantamento_linhas(lote_id,chave,tipo,atributos) values ('17900000-0000-0000-0000-000000000021','a','sistema','{}');
insert into storage.objects(id,bucket_id,name) values ('17900000-0000-0000-0000-000000000031','sso-levantamento-fotos','17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000031'),('17900000-0000-0000-0000-000000000032','sso-levantamento-fotos','17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000032');
insert into pcm.sso_fotos_levantamento(id,cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values ('17900000-0000-0000-0000-000000000041','17900000-0000-0000-0000-00000000000a','17900000-0000-0000-0000-000000000021','a','17900000-0000-0000-0000-000000000031','17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-000000000051'),('17900000-0000-0000-0000-000000000042','17900000-0000-0000-0000-00000000000a','17900000-0000-0000-0000-000000000021','a','17900000-0000-0000-0000-000000000032','17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-000000000052');
insert into pcm.sso_ingestao_foto_reservas(request_id,ator_id,cliente_id,lote_id,linha_chave,digest,nome,foto_id,objeto_id,confirmado_em) values ('17900000-0000-0000-0000-000000000052','17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-00000000000a','17900000-0000-0000-0000-000000000021','a',repeat('a',64),'17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000032','17900000-0000-0000-0000-000000000042','17900000-0000-0000-0000-000000000032',now());
insert into pcm.areas(id,cliente_id,nome) values ('17900000-0000-0000-0000-000000000081','17900000-0000-0000-0000-00000000000a','Área teste');
insert into pcm.locais(id,area_id,nome) values ('17900000-0000-0000-0000-000000000082','17900000-0000-0000-0000-000000000081','Local teste');
insert into pcm.equipamento_categorias(id,nome) values ('17900000-0000-0000-0000-000000000083','Categoria teste digest');
insert into pcm.grupos_quantitativos(id,cliente_id,local_id,categoria_id,nome,quantidade,created_by,updated_by) values ('17900000-0000-0000-0000-000000000084','17900000-0000-0000-0000-00000000000a','17900000-0000-0000-0000-000000000082','17900000-0000-0000-0000-000000000083','Grupo teste',1,'17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome,codigo) values ('17900000-0000-0000-0000-000000000085','17900000-0000-0000-0000-00000000000a','Sistema teste','DIGEST-TEST-SISTEMA');
insert into pcm.equipamentos(id,client_id,nome,tipo,identificador) values ('17900000-0000-0000-0000-000000000086','17900000-0000-0000-0000-00000000000a','Equipamento teste','equipamento','DIGEST-TEST-EQUIP');
insert into storage.objects(id,bucket_id,name) values
 ('17900000-0000-0000-0000-000000000033','sso-levantamento-fotos','17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000033'),
 ('17900000-0000-0000-0000-000000000034','sso-levantamento-fotos','17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000034');
insert into pcm.sso_fotos_levantamento(id,cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values
 ('17900000-0000-0000-0000-000000000043','17900000-0000-0000-0000-00000000000a','17900000-0000-0000-0000-000000000021','a','17900000-0000-0000-0000-000000000033','17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-000000000053'),
 ('17900000-0000-0000-0000-000000000044','17900000-0000-0000-0000-00000000000a','17900000-0000-0000-0000-000000000021','a','17900000-0000-0000-0000-000000000034','17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-000000000054');
insert into pcm.sso_ingestao_foto_reservas(request_id,ator_id,cliente_id,lote_id,linha_chave,digest,nome,foto_id,objeto_id,confirmado_em) values ('17900000-0000-0000-0000-000000000054','17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-00000000000a','17900000-0000-0000-0000-000000000021','a',repeat('b',64),'17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000034','17900000-0000-0000-0000-000000000044','17900000-0000-0000-0000-000000000034',now());
insert into pcm.sso_decisoes_foto_levantamento(foto_id,revisao,decisao,motivo,ator_id,request_id)
select f.id,1,'aceita','teste',f.ator_id,gen_random_uuid() from pcm.sso_fotos_levantamento f where f.id in ('17900000-0000-0000-0000-000000000041','17900000-0000-0000-0000-000000000042','17900000-0000-0000-0000-000000000043','17900000-0000-0000-0000-000000000044');
-- Simula vínculos preexistentes: somente dados sintéticos nesta transação.
set local session_replication_role=replica;
insert into pcm.sso_foto_staging_ativo(id,foto_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values
 ('17900000-0000-0000-0000-000000000091','17900000-0000-0000-0000-000000000041','sistema','17900000-0000-0000-0000-000000000085','17900000-0000-0000-0000-00000000000a',1,'17900000-0000-0000-0000-000000000001',gen_random_uuid()),
 ('17900000-0000-0000-0000-000000000092','17900000-0000-0000-0000-000000000042','sistema','17900000-0000-0000-0000-000000000085','17900000-0000-0000-0000-00000000000a',1,'17900000-0000-0000-0000-000000000001',gen_random_uuid()),
 ('17900000-0000-0000-0000-000000000093','17900000-0000-0000-0000-000000000043','equipamento','17900000-0000-0000-0000-000000000086','17900000-0000-0000-0000-00000000000a',1,'17900000-0000-0000-0000-000000000001',gen_random_uuid()),
 ('17900000-0000-0000-0000-000000000094','17900000-0000-0000-0000-000000000044','equipamento','17900000-0000-0000-0000-000000000086','17900000-0000-0000-0000-00000000000a',1,'17900000-0000-0000-0000-000000000001',gen_random_uuid());
insert into pcm.sso_foto_staging_grupo(id,foto_id,grupo_id,cliente_id,decisao_revision,ator_id,request_id) values
 ('17900000-0000-0000-0000-000000000095','17900000-0000-0000-0000-000000000041','17900000-0000-0000-0000-000000000084','17900000-0000-0000-0000-00000000000a',1,'17900000-0000-0000-0000-000000000001',gen_random_uuid()),
 ('17900000-0000-0000-0000-000000000096','17900000-0000-0000-0000-000000000042','17900000-0000-0000-0000-000000000084','17900000-0000-0000-0000-00000000000a',1,'17900000-0000-0000-0000-000000000001',gen_random_uuid());
insert into pcm.sso_atualizacoes_localizacao(lote_id,linha_chave,tipo,entidade_id,revisao,ator_id,request_id) values ('17900000-0000-0000-0000-000000000021','a','area','17900000-0000-0000-0000-000000000081',1,'17900000-0000-0000-0000-000000000001',gen_random_uuid());
insert into pcm.sso_anexos_localizacao_atualizada(id,tipo_anexo,anexo_id,lote_id,linha_chave,cliente_id,tipo_localizacao,entidade_id,decisao_revision,ator_id,request_id) values
 ('17900000-0000-0000-0000-000000000097','foto','17900000-0000-0000-0000-000000000041','17900000-0000-0000-0000-000000000021','a','17900000-0000-0000-0000-00000000000a','area','17900000-0000-0000-0000-000000000081',1,'17900000-0000-0000-0000-000000000001',gen_random_uuid()),
 ('17900000-0000-0000-0000-000000000098','foto','17900000-0000-0000-0000-000000000042','17900000-0000-0000-0000-000000000021','a','17900000-0000-0000-0000-00000000000a','area','17900000-0000-0000-0000-000000000081',1,'17900000-0000-0000-0000-000000000001',gen_random_uuid());
set local session_replication_role=origin;
create temporary table foto_oid_anterior as select 'pcm.sso_caminho_foto_levantamento(uuid)'::regprocedure::oid as id;
create temporary view foto_view_preexistente as select pcm.sso_caminho_foto_levantamento('17900000-0000-0000-0000-000000000042'::uuid) as caminho;
-- APLICAR_0970_AQUI
update pcm.sso_fotos_levantamento_gate set habilitado=true where id;
update pcm.sso_foto_staging_ativo_gate set habilitado=true where id;
update pcm.sso_foto_staging_grupo_gate set habilitado=true where id;
update pcm.sso_foto_equipamento_gate set habilitado=true where id;
update pcm.sso_acesso_anexo_localizacao_gate set habilitado=true where id;
update pcm.sso_anexo_localizacao_atualizada_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"17900000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
select is(pcm.sso_caminho_foto_levantamento('17900000-0000-0000-0000-000000000041'),'17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000031','foto legada continua acessível ao núcleo');
select throws_ok($$select pcm.sso_caminho_foto_levantamento('17900000-0000-0000-0000-000000000042')$$,'42501',null,'foto com digest não usa caminho legado');
select throws_ok($$insert into pcm.sso_foto_staging_ativo(foto_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values('17900000-0000-0000-0000-000000000042','sistema','17900000-0000-0000-0000-000000000061','17900000-0000-0000-0000-00000000000a',1,'17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-000000000071')$$,'55000',null,'vínculo legado de ativo recusado');
select throws_ok($$insert into pcm.sso_foto_staging_grupo(foto_id,grupo_id,cliente_id,decisao_revision,ator_id,request_id) values('17900000-0000-0000-0000-000000000042','17900000-0000-0000-0000-000000000062','17900000-0000-0000-0000-00000000000a',1,'17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-000000000072')$$,'55000',null,'vínculo legado de Grupo recusado');
select throws_ok($$insert into pcm.sso_anexos_localizacao_atualizada(tipo_anexo,anexo_id,lote_id,linha_chave,cliente_id,tipo_localizacao,entidade_id,decisao_revision,ator_id,request_id) values('foto','17900000-0000-0000-0000-000000000042','17900000-0000-0000-0000-000000000021','a','17900000-0000-0000-0000-00000000000a','area','17900000-0000-0000-0000-000000000063',1,'17900000-0000-0000-0000-000000000001','17900000-0000-0000-0000-000000000073')$$,'55000',null,'vínculo legado de Localização recusado');
select ok(not has_function_privilege('authenticated','pcm.sso_caminho_foto_levantamento_interno(uuid)','EXECUTE'),'authenticated não acessa resolvedor interno anterior');
select ok(not has_function_privilege('service_role','pcm.sso_caminho_foto_staging_ativo_interno(uuid)','EXECUTE'),'serviço não acessa resolvedor interno anterior');
select is((select count(*)::int from pcm.sso_fotos_levantamento where id in ('17900000-0000-0000-0000-000000000041','17900000-0000-0000-0000-000000000042')),2,'fotos são preservadas');
select is((select id from foto_oid_anterior),'pcm.sso_caminho_foto_levantamento(uuid)'::regprocedure::oid,'resolvedor mantém OID para dependências preexistentes');
select throws_ok($$select caminho from foto_view_preexistente$$,'42501',null,'view anterior também bloqueia acesso sem verificação de digest');
select is(pcm.sso_caminho_foto_staging_ativo('17900000-0000-0000-0000-000000000091'),'17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000031','ativo: foto legada acessível');
select throws_ok($$select pcm.sso_caminho_foto_staging_ativo('17900000-0000-0000-0000-000000000092')$$,'42501',null,'ativo: foto com digest bloqueada');
select is(pcm.sso_caminho_foto_staging_grupo('17900000-0000-0000-0000-000000000095'),'17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000031','grupo: foto legada acessível');
select throws_ok($$select pcm.sso_caminho_foto_staging_grupo('17900000-0000-0000-0000-000000000096')$$,'42501',null,'grupo: foto com digest bloqueada');
select is(pcm.sso_caminho_foto_equipamento_interno_v2('17900000-0000-0000-0000-000000000093'),'17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000033','equipamento: foto legada acessível');
select throws_ok($$select pcm.sso_caminho_foto_equipamento_interno_v2('17900000-0000-0000-0000-000000000094')$$,'42501',null,'equipamento: foto com digest bloqueada');
select is(pcm.sso_caminho_anexo_localizacao_atualizada('foto','17900000-0000-0000-0000-000000000097'),'17900000-0000-0000-0000-00000000000a/17900000-0000-0000-0000-000000000021/17900000-0000-0000-0000-000000000031','localização: foto legada acessível');
select throws_ok($$select pcm.sso_caminho_anexo_localizacao_atualizada('foto','17900000-0000-0000-0000-000000000098')$$,'42501',null,'localização: foto com digest bloqueada');
select * from finish();
rollback;
