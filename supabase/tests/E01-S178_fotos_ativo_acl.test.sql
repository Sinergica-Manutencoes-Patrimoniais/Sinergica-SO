-- Dados sintéticos; nenhum arquivo é enviado. Executar somente em banco isolado.
begin;
set local app.auvo_sync_write='true';
select plan(24);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('17830000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','foto-ativo-s178@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17830000-0000-0000-0000-000000000001','colaborador','Teste foto',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17830000-0000-0000-0000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17830000-0000-0000-0000-00000000000a','Foto A',true,'17830000-0000-0000-0000-000000000001'),
 ('17830000-0000-0000-0000-00000000000b','Foto B',true,'17830000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('17830000-0000-0000-0000-000000000001','cadastro.gerir','17830000-0000-0000-0000-00000000000a'),
 ('17830000-0000-0000-0000-000000000001','cadastro.aprovar','17830000-0000-0000-0000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome,codigo) values ('17830000-0000-0000-0000-000000000011','17830000-0000-0000-0000-00000000000a','Sistema teste','S178-FOTO-ACL');
insert into pcm.sistemas(id,cliente_id,nome,codigo) values ('17830000-0000-0000-0000-000000000012','17830000-0000-0000-0000-00000000000b','Sistema outro Cliente','S178-FOTO-ACL-B');
insert into pcm.equipamentos(id,client_id,nome,tipo,identificador) values ('17830000-0000-0000-0000-000000000013','17830000-0000-0000-0000-00000000000a','Componente teste','componente','S178-FOTO-COMP');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por) values
 ('17830000-0000-0000-0000-000000000021','17830000-0000-0000-0000-00000000000a','manual','foto-a','[]','17830000-0000-0000-0000-000000000001'),
 ('17830000-0000-0000-0000-000000000022','17830000-0000-0000-0000-00000000000b','manual','foto-b','[]','17830000-0000-0000-0000-000000000001');
insert into pcm.sso_levantamento_linhas(lote_id,chave,tipo,atributos) values ('17830000-0000-0000-0000-000000000021','s','sistema','{}'),('17830000-0000-0000-0000-000000000022','s','sistema','{}');
insert into pcm.sso_levantamento_linhas(lote_id,chave,tipo,atributos) values ('17830000-0000-0000-0000-000000000021','c','componente','{}');
insert into storage.objects(id,bucket_id,name) values ('17830000-0000-0000-0000-000000000031','sso-levantamento-fotos','teste-s178-objeto-privado');
insert into pcm.sso_fotos_levantamento(id,cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values
 ('17830000-0000-0000-0000-000000000041','17830000-0000-0000-0000-00000000000a','17830000-0000-0000-0000-000000000021','s','17830000-0000-0000-0000-000000000031','17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000051'),
 ('17830000-0000-0000-0000-000000000042','17830000-0000-0000-0000-00000000000b','17830000-0000-0000-0000-000000000022','s','17830000-0000-0000-0000-000000000032','17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000052');
insert into pcm.sso_decisoes_foto_levantamento(foto_id,revisao,decisao,motivo,ator_id,request_id) values ('17830000-0000-0000-0000-000000000041',1,'aceita','teste','17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000061');
insert into pcm.sso_fotos_levantamento(id,cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values
 ('17830000-0000-0000-0000-000000000043','17830000-0000-0000-0000-00000000000a','17830000-0000-0000-0000-000000000021','s','17830000-0000-0000-0000-000000000033','17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000053'),
 ('17830000-0000-0000-0000-000000000044','17830000-0000-0000-0000-00000000000a','17830000-0000-0000-0000-000000000021','c','17830000-0000-0000-0000-000000000034','17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000054');
insert into pcm.sso_decisoes_foto_levantamento(foto_id,revisao,decisao,motivo,ator_id,request_id) values ('17830000-0000-0000-0000-000000000043',1,'aceita','teste','17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000063'),('17830000-0000-0000-0000-000000000044',1,'aceita','teste','17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000064');
insert into pcm.sso_foto_staging_ativo(id,foto_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values ('17830000-0000-0000-0000-000000000071','17830000-0000-0000-0000-000000000041','sistema','17830000-0000-0000-0000-000000000011','17830000-0000-0000-0000-00000000000a',1,'17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000081');
insert into pcm.sso_foto_staging_ativo(id,foto_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values ('17830000-0000-0000-0000-000000000073','17830000-0000-0000-0000-000000000043','sistema','17830000-0000-0000-0000-000000000011','17830000-0000-0000-0000-00000000000a',1,'17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000083'),('17830000-0000-0000-0000-000000000074','17830000-0000-0000-0000-000000000044','componente','17830000-0000-0000-0000-000000000013','17830000-0000-0000-0000-00000000000a',1,'17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000084');
update pcm.sso_foto_staging_ativo_gate set habilitado=true where id;
update pcm.sso_fotos_levantamento_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"17830000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select is((select count(*)::int from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000011',null,20)),2,'listagem autorizada');
select is((select count(*)::int from pcm.sso_listar_fotos_staging_ativo_mediado('componente','17830000-0000-0000-0000-000000000013',null,20)),1,'listagem de Componente autorizado');
select throws_ok($$select * from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000012',null,20)$$,'42501',null,'listagem de outro Cliente negada');
select throws_ok($$select * from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000011',null,0)$$,'22023',null,'limite inválido é recusado');
select ok(not has_function_privilege('anon','pcm.sso_listar_fotos_staging_ativo_mediado(text,uuid,uuid,integer)','EXECUTE'),'anon não pode listar fotos');
select throws_ok($$select pcm.sso_caminho_foto_staging_ativo('17830000-0000-0000-0000-000000000071')$$,'42501',null,'caminho interno não acessível ao navegador');
select throws_ok($$select pcm.sso_caminho_foto_staging_ativo_servico('17830000-0000-0000-0000-000000000071','17830000-0000-0000-0000-000000000001','colaborador')$$,'42501',null,'serviço não acessível ao navegador');
select throws_ok($$select pcm.sso_consultar_destino_foto_ativo_mediado_v2('17830000-0000-0000-0000-000000000042')$$,'42501',null,'foto de outro Cliente negada');
select throws_ok($$select pcm.sso_consultar_destino_foto_ativo_mediado_v2('17830000-0000-0000-0000-000000000099')$$,'42501',null,'foto ausente negada');
select ok((pcm.sso_consultar_destino_foto_ativo_mediado('17830000-0000-0000-0000-000000000041') ? 'fotoInadequada') is false,'contrato antigo preservado');
select ok((pcm.sso_consultar_destino_foto_ativo_mediado_v2('17830000-0000-0000-0000-000000000041')->>'fotoInadequada')::boolean is false,'v2 informa adequação atual');
reset role;
update pcm.sso_foto_staging_ativo_gate set habilitado=false where id;
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000011',null,20)$$,'55000',null,'gate de ativo fechado bloqueia listagem');
reset role;
update pcm.sso_foto_staging_ativo_gate set habilitado=true where id;
update pcm.sso_fotos_levantamento_gate set habilitado=false where id;
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000011',null,20)$$,'55000',null,'gate de fotos fechado bloqueia listagem');
reset role;
update pcm.sso_fotos_levantamento_gate set habilitado=true where id;
set local role service_role;
select is(pcm.sso_caminho_foto_staging_ativo_servico('17830000-0000-0000-0000-000000000071','17830000-0000-0000-0000-000000000001','colaborador'),'teste-s178-objeto-privado','serviço com identidade autorizada resolve caminho');
reset role;
insert into pcm.sso_adequacao_foto_decisoes(foto_id,revisao,estado,motivo,ator_id,request_id) values ('17830000-0000-0000-0000-000000000041',1,'inadequada','teste','17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000091');
set local role authenticated;
select is((select id from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000011',null,1)),'17830000-0000-0000-0000-000000000073'::uuid,'primeira página ignora foto inadequada anterior ao limite');
select is((select count(*)::int from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000011','17830000-0000-0000-0000-000000000073',1)),0,'cursor da foto adequada encerra paginação');
select is((select id from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000011','17830000-0000-0000-0000-000000000071',1)),'17830000-0000-0000-0000-000000000073'::uuid,'cursor anterior retorna próxima foto adequada');
select is((select count(*)::int from pcm.sso_listar_fotos_staging_ativo_mediado('componente','17830000-0000-0000-0000-000000000013',null,20)),1,'inadequação de outra foto não afeta Componente');
select ok((pcm.sso_consultar_destino_foto_ativo_mediado_v2('17830000-0000-0000-0000-000000000041')->>'fotoInadequada')::boolean,'v2 informa inadequação');
reset role;
set local role service_role;
select throws_ok($$select pcm.sso_caminho_foto_staging_ativo_servico('17830000-0000-0000-0000-000000000071','17830000-0000-0000-0000-000000000001','colaborador')$$,'42501',null,'serviço recusa foto inadequada');
reset role;
insert into pcm.sso_adequacao_foto_decisoes(foto_id,revisao,estado,motivo,ator_id,request_id) values ('17830000-0000-0000-0000-000000000041',2,'reavaliada','teste','17830000-0000-0000-0000-000000000001','17830000-0000-0000-0000-000000000092');
set local role service_role;
select is(pcm.sso_caminho_foto_staging_ativo_servico('17830000-0000-0000-0000-000000000071','17830000-0000-0000-0000-000000000001','colaborador'),'teste-s178-objeto-privado','foto reavaliada está acessível antes da revogação');
reset role;
set local role authenticated;
select is((select count(*)::int from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000011',null,20)),2,'foto reavaliada está listável antes da revogação');
reset role;
update config.sso_concessoes set ativa=false where usuario_id='17830000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_fotos_staging_ativo_mediado('sistema','17830000-0000-0000-0000-000000000011',null,20)$$,'42501',null,'listagem respeita revogação');
reset role;
set local role service_role;
select throws_ok($$select pcm.sso_caminho_foto_staging_ativo_servico('17830000-0000-0000-0000-000000000071','17830000-0000-0000-0000-000000000001','colaborador')$$,'42501',null,'serviço respeita revogação');
reset role;
select * from finish();
rollback;
