-- ADR-0728: teste de contrato proposto, ainda vermelho antes da extensão.
-- Contrato técnico proposto: mediadores versionados v2 e gate específico abaixo;
-- sem implementação, as asserções correspondentes são intencionalmente vermelhas.
-- Banco isolado, sem arquivo real, rollback.
begin;
set local app.auvo_sync_write='true';
select plan(13);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('17850000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','foto-equipamento-s178@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17850000-0000-0000-0000-000000000001','colaborador','Foto equipamento',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('17850000-0000-0000-0000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('17850000-0000-0000-0000-00000000000a','Cliente A',true,'17850000-0000-0000-0000-000000000001'),('17850000-0000-0000-0000-00000000000b','Cliente B',true,'17850000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17850000-0000-0000-0000-000000000001','cadastro.gerir','17850000-0000-0000-0000-00000000000a'),('17850000-0000-0000-0000-000000000001','cadastro.aprovar','17850000-0000-0000-0000-00000000000a');
insert into pcm.equipamentos(id,client_id,nome,tipo,identificador) values ('17850000-0000-0000-0000-000000000011','17850000-0000-0000-0000-00000000000a','Equipamento A','equipamento','S178-FOTO-EQUIP-A'),('17850000-0000-0000-0000-000000000012','17850000-0000-0000-0000-00000000000b','Equipamento B','equipamento','S178-FOTO-EQUIP-B'),('17850000-0000-0000-0000-000000000013','17850000-0000-0000-0000-00000000000a','Componente A','componente','S178-FOTO-COMP-A');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por) values ('17850000-0000-0000-0000-000000000021','17850000-0000-0000-0000-00000000000a','manual','equip-a','[]','17850000-0000-0000-0000-000000000001'),('17850000-0000-0000-0000-000000000022','17850000-0000-0000-0000-00000000000b','manual','equip-b','[]','17850000-0000-0000-0000-000000000001');
insert into pcm.sso_levantamento_linhas(lote_id,chave,tipo,atributos) values ('17850000-0000-0000-0000-000000000021','e','equipamento','{}'),('17850000-0000-0000-0000-000000000022','e','equipamento','{}');
-- Reprodução de efeito oficial anterior, sem disparar integrações.
set local session_replication_role=replica;
insert into pcm.sso_levantamento_incorporacoes(lote_id,linha_chave,tipo,entidade_id,revisao,ator_id,request_id) values ('17850000-0000-0000-0000-000000000021','e','equipamento','17850000-0000-0000-0000-000000000011',2,'17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000031');
set local session_replication_role=origin;
insert into pcm.sso_fotos_levantamento(id,cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values ('17850000-0000-0000-0000-000000000041','17850000-0000-0000-0000-00000000000a','17850000-0000-0000-0000-000000000021','e','17850000-0000-0000-0000-000000000051','17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000061'),('17850000-0000-0000-0000-000000000042','17850000-0000-0000-0000-00000000000b','17850000-0000-0000-0000-000000000022','e','17850000-0000-0000-0000-000000000052','17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000062');
insert into pcm.sso_decisoes_foto_levantamento(foto_id,revisao,decisao,motivo,ator_id,request_id) values ('17850000-0000-0000-0000-000000000041',1,'aceita','teste','17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000071');
set local request.jwt.claims='{"sub":"17850000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok($$select pcm.sso_vincular_foto_staging_ativo_mediado_v2('17850000-0000-0000-0000-000000000081','17850000-0000-0000-0000-000000000041','equipamento','17850000-0000-0000-0000-000000000011',1)$$,'55000',null,'gate existente fechado bloqueia Equipamento');
select throws_ok($$select pcm.sso_vincular_foto_staging_ativo('17850000-0000-0000-0000-000000000081','17850000-0000-0000-0000-000000000041','equipamento','17850000-0000-0000-0000-000000000011',1)$$,'42501',null,'núcleo continua privado');
reset role;
update pcm.sso_foto_staging_ativo_gate set habilitado=true where id;
update pcm.sso_fotos_levantamento_gate set habilitado=true where id;
select has_table('pcm','sso_foto_equipamento_gate','gate específico existe');
set local role authenticated;
select throws_ok($$select pcm.sso_vincular_foto_staging_ativo_mediado('17850000-0000-0000-0000-000000000081','17850000-0000-0000-0000-000000000041','equipamento','17850000-0000-0000-0000-000000000011',1)$$,'22023',null,'contrato antigo continua sem aceitar Equipamento');
select throws_ok($$select * from pcm.sso_listar_fotos_staging_ativo_mediado('equipamento','17850000-0000-0000-0000-000000000011',null,20)$$,'22023',null,'listagem antiga preserva enum');
select throws_ok($$select pcm.sso_vincular_foto_staging_ativo_mediado_v2('17850000-0000-0000-0000-000000000081','17850000-0000-0000-0000-000000000041','equipamento','17850000-0000-0000-0000-000000000011',1)$$,'55000',null,'gate específico fechado bloqueia Equipamento mesmo com gates anteriores abertos');
reset role;
-- Ativação somente da fixture, se a implementação aditiva existir.
do $$ begin if to_regclass('pcm.sso_foto_equipamento_gate') is not null then execute 'update pcm.sso_foto_equipamento_gate set habilitado=true where id'; end if; end $$;
-- Estado histórico sintético: a retirada não deve consumir uma página do destino.
insert into pcm.sso_fotos_levantamento(id,cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values
 ('17850000-0000-0000-0000-000000000043','17850000-0000-0000-0000-00000000000a','17850000-0000-0000-0000-000000000021','e','17850000-0000-0000-0000-000000000053','17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000063'),
 ('17850000-0000-0000-0000-000000000044','17850000-0000-0000-0000-00000000000a','17850000-0000-0000-0000-000000000021','e','17850000-0000-0000-0000-000000000054','17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000064');
insert into pcm.sso_decisoes_foto_levantamento(foto_id,revisao,decisao,motivo,ator_id,request_id) values
 ('17850000-0000-0000-0000-000000000043',1,'aceita','teste','17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000073'),
 ('17850000-0000-0000-0000-000000000044',1,'aceita','teste','17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000074');
insert into pcm.sso_foto_staging_ativo(id,foto_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values
 ('17850000-0000-0000-0000-000000000091','17850000-0000-0000-0000-000000000043','equipamento','17850000-0000-0000-0000-000000000011','17850000-0000-0000-0000-00000000000a',1,'17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000093'),
 ('17850000-0000-0000-0000-000000000092','17850000-0000-0000-0000-000000000044','equipamento','17850000-0000-0000-0000-000000000011','17850000-0000-0000-0000-00000000000a',1,'17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000094');
insert into pcm.sso_retiradas_anexo(tipo,anexo_id,cliente_id,lote_id,motivo,ator_id,request_id) values ('foto','17850000-0000-0000-0000-000000000043','17850000-0000-0000-0000-00000000000a','17850000-0000-0000-0000-000000000021','teste de estado histórico','17850000-0000-0000-0000-000000000001','17850000-0000-0000-0000-000000000095');
set local role authenticated;
select is((select id from pcm.sso_listar_fotos_staging_ativo_mediado_v2('equipamento','17850000-0000-0000-0000-000000000011',null,1)),'17850000-0000-0000-0000-000000000092'::uuid,'foto retirada anterior ao limite não consome página');
select throws_ok($$select pcm.sso_vincular_foto_staging_ativo_mediado_v2('17850000-0000-0000-0000-000000000082','17850000-0000-0000-0000-000000000042','equipamento','17850000-0000-0000-0000-000000000012',1)$$,'42501',null,'foto de outro Cliente é negada');
select throws_ok($$select pcm.sso_vincular_foto_staging_ativo_mediado_v2('17850000-0000-0000-0000-000000000083','17850000-0000-0000-0000-000000000041','equipamento','17850000-0000-0000-0000-000000000013',1)$$,'23514',null,'Componente não pode ser usado como Equipamento');
select lives_ok($$select pcm.sso_vincular_foto_staging_ativo_mediado_v2('17850000-0000-0000-0000-000000000081','17850000-0000-0000-0000-000000000041','equipamento','17850000-0000-0000-0000-000000000011',1)$$,'foto aceita da mesma linha vinculada a Equipamento autorizado');
select lives_ok($$select * from pcm.sso_listar_fotos_staging_ativo_mediado_v2('equipamento','17850000-0000-0000-0000-000000000011',null,20)$$,'listagem de Equipamento autorizado');
select throws_ok($$select * from pcm.sso_listar_fotos_staging_ativo_mediado_v2('equipamento','17850000-0000-0000-0000-000000000012',null,20)$$,'42501',null,'listagem de outro Cliente negada');
reset role;
update config.sso_concessoes set ativa=false where usuario_id='17850000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok($$select * from pcm.sso_listar_fotos_staging_ativo_mediado_v2('equipamento','17850000-0000-0000-0000-000000000011',null,20)$$,'42501',null,'listagem respeita revogação');
reset role;
select * from finish();
rollback;
