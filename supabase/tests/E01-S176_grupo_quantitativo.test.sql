-- E01-S176 AC-3/AC-4: grupo físico único, autorização, revisão e auditoria.
begin;
set local app.auvo_sync_write = 'true';
select plan(27);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17610000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-grupo-s176@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('17610000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operador-grupo-s176@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('17610000-0000-0000-0000-000000000001', 'superadmin', 'Admin grupo S176', true),
 ('17610000-0000-0000-0000-000000000002', 'colaborador', 'Operador grupo S176', true);
insert into config.usuario_modulos (user_id, modulo, nivel) values ('17610000-0000-0000-0000-000000000002', 'pcm', 'escrita');
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('17610000-0000-0000-0000-00000000000a', 'Cliente A grupos S176', true, '17610000-0000-0000-0000-000000000001'),
 ('17610000-0000-0000-0000-00000000000b', 'Cliente B grupos S176', true, '17610000-0000-0000-0000-000000000001');
insert into pcm.areas (id, cliente_id, nome) values
 ('17610000-0000-0000-0000-000000000021', '17610000-0000-0000-0000-00000000000a', 'Área A'),
 ('17610000-0000-0000-0000-000000000022', '17610000-0000-0000-0000-00000000000b', 'Área B');
insert into pcm.locais (id, area_id, nome) values
 ('17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000021', 'Salão A'),
 ('17610000-0000-0000-0000-000000000032', '17610000-0000-0000-0000-000000000022', 'Salão B');
insert into pcm.equipamento_categorias (id, nome) values ('17610000-0000-0000-0000-000000000041', 'Luminária S176');
insert into pcm.sistemas (id, cliente_id, nome) values
 ('17610000-0000-0000-0000-000000000051', '17610000-0000-0000-0000-00000000000a', 'Sistema A'),
 ('17610000-0000-0000-0000-000000000052', '17610000-0000-0000-0000-00000000000b', 'Sistema B');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('17610000-0000-0000-0000-000000000001', 'cadastro.gerir', '17610000-0000-0000-0000-00000000000a'),
 ('17610000-0000-0000-0000-000000000001', 'cadastro.gerir', '17610000-0000-0000-0000-00000000000b');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select lives_ok($$ select pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000101', 0, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', '17610000-0000-0000-0000-000000000051', 'Luminárias', 20, '{"potencia":"12 W"}') $$, 'cria grupo de 20 luminárias');
select is((pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000101', 0, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', '17610000-0000-0000-0000-000000000051', 'Luminárias', 20, '{"potencia":"12 W"}') ->> 'revision')::int, 1, 'retry idêntico preserva revisão');
select throws_ok($$ select pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000101', 0, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', null, 'Luminárias', 21, '{}') $$, '23505', null, 'requestId com outro conteúdo conflita');
select throws_ok($$ select pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000102', 0, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', null, 'Luminárias', 21, '{}') $$, '40001', null, 'revisão antiga é recusada');
select throws_ok($$ select pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000103', 1, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000032', '17610000-0000-0000-0000-000000000041', null, 'Luminárias', 20, '{}') $$, '23514', null, 'grupo não muda de Cliente ao mover Local');
select throws_ok($$ select pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000104', 1, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', '17610000-0000-0000-0000-000000000052', 'Luminárias', 20, '{}') $$, '23514', null, 'Sistema de outro Cliente é recusado');
select throws_ok($$ select pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000105', 1, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', null, 'Luminárias', 0, '{}') $$, '22023', null, 'quantidade zero é recusada');
select lives_ok($$ select pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000106', 1, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', '17610000-0000-0000-0000-000000000051', 'Luminárias', 21, '{"potencia":"12 W"}') $$, 'atualização com revisão atual é aceita');
select is((select quantidade from pcm.grupos_quantitativos where id = '17610000-0000-0000-0000-000000000061'), 21::bigint, 'grupo preserva identidade e quantidade atual');
select is((select count(*)::int from pcm.sso_listar_historico_estrutura('grupo', '17610000-0000-0000-0000-000000000061', 50, null, null)), 2, 'histórico do grupo apresenta criação e atualização');
select is((select count(*)::int from pcm.sso_listar_historico_estrutura('grupo', '17610000-0000-0000-0000-000000000061', 1, null, null)), 1, 'histórico respeita limite de página');
select is((select count(*)::int from pcm.sso_listar_historico_estrutura('grupo', '17610000-0000-0000-0000-000000000061', 1, null, null) primeiro cross join lateral pcm.sso_listar_historico_estrutura('grupo', '17610000-0000-0000-0000-000000000061', 1, primeiro.ocorrido_em, primeiro.evento_id) segundo where primeiro.evento_id <> segundo.evento_id), 1, 'cursor desempata eventos com mesma data sem repetir');
select throws_ok($$ select * from pcm.sso_listar_historico_estrutura('grupo', '17610000-0000-0000-0000-000000000061', 101, null, null) $$, '22023', null, 'limite excessivo é recusado');
select throws_ok($$ select * from pcm.sso_listar_historico_estrutura(null, '17610000-0000-0000-0000-000000000061', 20, null, null) $$, '22023', null, 'tipo ausente no histórico é recusado');
reset role;
update pcm.sistemas set ativo = false where id = '17610000-0000-0000-0000-000000000051';
set local role authenticated;
select is((pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000101', 0, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', '17610000-0000-0000-0000-000000000051', 'Luminárias', 20, '{"potencia":"12 W"}') ->> 'revision')::int, 1, 'retry mantém resultado original mesmo com Sistema posteriormente inativo');
reset role;
update config.sso_concessoes set ativa = false where usuario_id = '17610000-0000-0000-0000-000000000001' and cliente_id = '17610000-0000-0000-0000-00000000000a' and acao = 'cadastro.gerir';
set local role authenticated;
select throws_ok($$ select pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000101', 0, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', '17610000-0000-0000-0000-000000000051', 'Luminárias', 20, '{"potencia":"12 W"}') $$, '42501', null, 'retry não ignora revogação da capacidade');
select is((select count(*)::int from pcm.grupos_quantitativos where id = '17610000-0000-0000-0000-000000000061'), 0, 'revogação também impede leitura imediata');
reset role;
select is((select count(*)::int from pcm.equipamentos where id = '17610000-0000-0000-0000-000000000061'), 0, 'grupo não cria equipamento individual');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id = '17610000-0000-0000-0000-000000000061'), 0, 'grupo não enfileira sincronização Auvo');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17610000-0000-0000-0000-000000000002","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select is((select count(*)::int from pcm.grupos_quantitativos where id = '17610000-0000-0000-0000-000000000061'), 0, 'usuário sem capacidade não lê grupo por consulta direta');
select throws_ok($$ select * from pcm.sso_listar_historico_estrutura('grupo', '17610000-0000-0000-0000-000000000061', 50, null, null) $$, '42501', null, 'histórico exige capacidade atual no Cliente');
select throws_ok($$ select pcm.sso_salvar_grupo_quantitativo('17610000-0000-0000-0000-000000000107', 1, '17610000-0000-0000-0000-000000000061', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', null, 'Luminárias', 22, '{}') $$, '42501', null, 'PCM sem capacidade de cadastro não altera grupo');
select throws_ok($$ insert into pcm.grupos_quantitativos (id, cliente_id, local_id, categoria_id, nome, quantidade) values ('17610000-0000-0000-0000-000000000062', '17610000-0000-0000-0000-00000000000a', '17610000-0000-0000-0000-000000000031', '17610000-0000-0000-0000-000000000041', 'Indevido', 1) $$, '42501', null, 'escrita direta é negada');
set local role service_role;
select is((select count(*)::int from audit.events where entity = 'grupos_quantitativos' and entity_id = '17610000-0000-0000-0000-000000000061'), 2, 'criação e atualização geram dois eventos');
reset role;
select throws_ok($$ update pcm.locais set area_id = '17610000-0000-0000-0000-000000000022' where id = '17610000-0000-0000-0000-000000000031' $$, '23514', null, 'Local com grupo não muda para outro Cliente');
select throws_ok($$ update pcm.areas set cliente_id = '17610000-0000-0000-0000-00000000000b' where id = '17610000-0000-0000-0000-000000000021' $$, '23514', null, 'Área com grupo não muda de Cliente');
select throws_ok($$ update pcm.sistemas set cliente_id = '17610000-0000-0000-0000-00000000000b' where id = '17610000-0000-0000-0000-000000000051' $$, '23514', null, 'Sistema com grupo não muda de Cliente');
select * from finish();
rollback;
