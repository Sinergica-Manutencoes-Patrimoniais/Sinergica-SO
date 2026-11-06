-- E01-S176 AC-2: integridade de hierarquia; dados sintéticos e rollback.
begin;
set local app.auvo_sync_write = 'true';
select plan(53);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('17600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'estrutura-s176@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('17600000-0000-0000-0000-00000000000a', 'Cliente A S176', true, '17600000-0000-0000-0000-000000000001'),
 ('17600000-0000-0000-0000-00000000000b', 'Cliente B S176', true, '17600000-0000-0000-0000-000000000001');
insert into pcm.areas(id, cliente_id, nome) values
 ('17600000-0000-0000-0000-000000000021', '17600000-0000-0000-0000-00000000000a', 'Área A'),
 ('17600000-0000-0000-0000-000000000022', '17600000-0000-0000-0000-00000000000b', 'Área B'),
 ('17600000-0000-0000-0000-000000000023', '17600000-0000-0000-0000-00000000000a', 'Área de Sistema'),
 ('17600000-0000-0000-0000-000000000024', '17600000-0000-0000-0000-00000000000a', 'Outra Área A');
insert into pcm.locais(id, area_id, nome) values
 ('17600000-0000-0000-0000-000000000031', '17600000-0000-0000-0000-000000000021', 'Local A'),
 ('17600000-0000-0000-0000-000000000032', '17600000-0000-0000-0000-000000000022', 'Local B'),
 ('17600000-0000-0000-0000-000000000033', '17600000-0000-0000-0000-000000000023', 'Local de Sistema');
insert into pcm.locais(id, area_id, parent_id, nome) values
 ('17600000-0000-0000-0000-000000000034', '17600000-0000-0000-0000-000000000021', '17600000-0000-0000-0000-000000000031', 'Sublocal');
insert into pcm.sistemas(id, cliente_id, local_id, nome) values
 ('17600000-0000-0000-0000-000000000051', '17600000-0000-0000-0000-00000000000a', '17600000-0000-0000-0000-000000000033', 'Sistema físico');
insert into pcm.equipamentos (id, nome, client_id, ativo) values
 ('17600000-0000-0000-0000-000000000011', 'Raiz A', '17600000-0000-0000-0000-00000000000a', true),
 ('17600000-0000-0000-0000-000000000012', 'Filho A', '17600000-0000-0000-0000-00000000000a', true),
 ('17600000-0000-0000-0000-000000000013', 'Raiz B', '17600000-0000-0000-0000-00000000000b', true),
 ('17600000-0000-0000-0000-000000000014', 'Neto A', '17600000-0000-0000-0000-00000000000a', true),
 ('17600000-0000-0000-0000-000000000015', 'Inativo A', '17600000-0000-0000-0000-00000000000a', false);
select lives_ok($$ insert into pcm.equipamentos(id, nome, client_id, local_id, parent_item_id) values ('17600000-0000-0000-0000-000000000017', 'Filho instalado', null, '17600000-0000-0000-0000-000000000031', '17600000-0000-0000-0000-000000000011') $$, 'Local deriva Cliente antes de validar o pai');
insert into pcm.equipamentos(id, nome, client_id, local_id) values
 ('17600000-0000-0000-0000-000000000018', 'Componente em Sublocal', '17600000-0000-0000-0000-00000000000a', '17600000-0000-0000-0000-000000000034');
select throws_ok($$ update pcm.equipamentos set local_id = '17600000-0000-0000-0000-000000000032' where id = '17600000-0000-0000-0000-000000000017' $$, '23514', null, 'Local de outro Cliente é recusado');
select throws_ok($$ update pcm.locais set area_id = '17600000-0000-0000-0000-000000000022' where id = '17600000-0000-0000-0000-000000000031' $$, '23514', null, 'Local não abandona Cliente de Componentes instalados');
select throws_ok($$ update pcm.areas set cliente_id = '17600000-0000-0000-0000-00000000000b' where id = '17600000-0000-0000-0000-000000000021' $$, '23514', null, 'Área não abandona Cliente de Componentes instalados');
select throws_ok($$ update pcm.locais set area_id = '17600000-0000-0000-0000-000000000022' where id = '17600000-0000-0000-0000-000000000033' $$, '23514', null, 'Local não abandona Cliente do Sistema instalado');
select throws_ok($$ update pcm.areas set cliente_id = '17600000-0000-0000-0000-00000000000b' where id = '17600000-0000-0000-0000-000000000023' $$, '23514', null, 'Área não abandona Cliente do Sistema instalado');
select lives_ok($$ update pcm.locais set area_id = '17600000-0000-0000-0000-000000000024' where id = '17600000-0000-0000-0000-000000000031' $$, 'Local pode mudar de Área no mesmo Cliente');
select is((select area_id::text from pcm.equipamentos where id = '17600000-0000-0000-0000-000000000017'), '17600000-0000-0000-0000-000000000024', 'Componente acompanha a Área do Local');
select is((select area_id::text from pcm.locais where id = '17600000-0000-0000-0000-000000000034'), '17600000-0000-0000-0000-000000000024', 'Sublocal acompanha a Área do pai');
select is((select parent_id::text from pcm.locais where id = '17600000-0000-0000-0000-000000000034'), '17600000-0000-0000-0000-000000000031', 'movimentação preserva vínculo do Sublocal');
select is((select area_id::text from pcm.equipamentos where id = '17600000-0000-0000-0000-000000000018'), '17600000-0000-0000-0000-000000000024', 'Componente no Sublocal acompanha a movimentação');
select is((select count(*)::int from audit.events where entity = 'equipamentos' and entity_id = '17600000-0000-0000-0000-000000000018' and action = 'estrutura.movimentada'), 1, 'movimento propagado registra histórico do Componente');
savepoint antes_de_mover_novamente;
update pcm.locais set area_id = '17600000-0000-0000-0000-000000000021' where id = '17600000-0000-0000-0000-000000000031';
rollback to savepoint antes_de_mover_novamente;
select is((select area_id::text from pcm.equipamentos where id = '17600000-0000-0000-0000-000000000018'), '17600000-0000-0000-0000-000000000024', 'rollback restaura posição de toda a subárvore');
select is((select count(*)::int from audit.events where entity = 'equipamentos' and entity_id = '17600000-0000-0000-0000-000000000018' and action = 'estrutura.movimentada'), 1, 'rollback também desfaz histórico propagado');
select lives_ok($$ update pcm.locais set area_id = '17600000-0000-0000-0000-000000000024' where id = '17600000-0000-0000-0000-000000000033' $$, 'Local de Sistema muda de Área no mesmo Cliente');
select is((select area_id::text from pcm.sistemas where id = '17600000-0000-0000-0000-000000000051'), '17600000-0000-0000-0000-000000000024', 'Sistema acompanha a Área do Local');

select lives_ok($$ update pcm.equipamentos set parent_item_id = '17600000-0000-0000-0000-000000000011' where id = '17600000-0000-0000-0000-000000000012' $$, 'pai do mesmo Cliente é permitido');
select is((select count(*)::int from audit.events where entity = 'equipamentos' and entity_id = '17600000-0000-0000-0000-000000000012' and action = 'estrutura.movimentada'), 1, 'mudança de pai registra evento histórico');
select is((select payload -> 'depois' ->> 'parent_item_id' from audit.events where entity = 'equipamentos' and entity_id = '17600000-0000-0000-0000-000000000012' and action = 'estrutura.movimentada'), '17600000-0000-0000-0000-000000000011', 'histórico registra novo pai sem substituir identidade');
update pcm.equipamentos set parent_item_id = parent_item_id where id = '17600000-0000-0000-0000-000000000012';
select is((select count(*)::int from audit.events where entity = 'equipamentos' and entity_id = '17600000-0000-0000-0000-000000000012' and action = 'estrutura.movimentada'), 1, 'alteração sem mudança não duplica histórico');
select lives_ok($$ update pcm.equipamentos set parent_item_id = '17600000-0000-0000-0000-000000000012' where id = '17600000-0000-0000-0000-000000000014' $$, 'árvore com vários níveis é permitida');
select throws_ok($$ update pcm.equipamentos set parent_item_id = '17600000-0000-0000-0000-000000000014' where id = '17600000-0000-0000-0000-000000000011' $$, '23514', null, 'ciclo indireto é recusado');
select throws_ok($$ update pcm.equipamentos set parent_item_id = '17600000-0000-0000-0000-000000000011' where id = '17600000-0000-0000-0000-000000000011' $$, '23514', null, 'autoparente é recusado');
select throws_ok($$ update pcm.equipamentos set parent_item_id = '17600000-0000-0000-0000-000000000013' where id = '17600000-0000-0000-0000-000000000012' $$, '23514', null, 'pai de outro Cliente é recusado');
select throws_ok($$ update pcm.equipamentos set parent_item_id = '17600000-0000-0000-0000-000000000015' where id = '17600000-0000-0000-0000-000000000012' $$, '23514', null, 'pai inativo é recusado');
select throws_ok($$ update pcm.equipamentos set parent_item_id = '17600000-0000-0000-0000-000000000099' where id = '17600000-0000-0000-0000-000000000012' $$, '23514', null, 'pai inexistente é recusado');
select throws_ok($$ update pcm.equipamentos set client_id = '17600000-0000-0000-0000-00000000000b' where id = '17600000-0000-0000-0000-000000000011' $$, '23514', null, 'movimento que deixaria filhos em outro Cliente é recusado');
select lives_ok($$ insert into pcm.equipamentos (id, nome, client_id) values ('17600000-0000-0000-0000-000000000016', 'Legado sem cliente', null) $$, 'cadastro legado sem Cliente e sem pai continua aceito');
savepoint antes_da_reversao;
update pcm.equipamentos set ativo = true where id = '17600000-0000-0000-0000-000000000015';
rollback to savepoint antes_da_reversao;
select is((select count(*)::int from audit.events where entity = 'equipamentos' and entity_id = '17600000-0000-0000-0000-000000000015' and action = 'estrutura.movimentada'), 0, 'rollback remove evento junto com mudança');
select is((select ativo from pcm.equipamentos where id = '17600000-0000-0000-0000-000000000015'), false, 'rollback preserva estado anterior');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17600000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select throws_ok($$ update pcm.equipamentos set parent_item_id = '17600000-0000-0000-0000-000000000013' where id = '17600000-0000-0000-0000-000000000012' $$, '23514', null, 'escrita direta autenticada também verifica Cliente');
update pcm.equipamentos set parent_item_id = null where id = '17600000-0000-0000-0000-000000000014';
reset role;
select is((select actor_id::text from audit.events where entity = 'equipamentos' and entity_id = '17600000-0000-0000-0000-000000000014' and action = 'estrutura.movimentada' and payload -> 'depois' ->> 'parent_item_id' is null), '17600000-0000-0000-0000-000000000001', 'movimentação autenticada registra ator');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17600000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{}}';
update pcm.equipamentos set nome = 'Alteração indevida' where id = '17600000-0000-0000-0000-000000000011';
reset role;
select is((select nome from pcm.equipamentos where id = '17600000-0000-0000-0000-000000000011'), 'Raiz A', 'usuário sem PCM não altera o Componente');
insert into config.usuarios(user_id, papel, nome, ativo) values ('17600000-0000-0000-0000-000000000001', 'superadmin', 'Histórico S176', true);
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('17600000-0000-0000-0000-000000000001', 'cadastro.ler', '17600000-0000-0000-0000-00000000000b');
update pcm.equipamentos set client_id = '17600000-0000-0000-0000-00000000000b' where id = '17600000-0000-0000-0000-000000000016';
update pcm.equipamentos set client_id = '17600000-0000-0000-0000-00000000000a' where id = '17600000-0000-0000-0000-000000000013';
update pcm.equipamentos set client_id = '17600000-0000-0000-0000-00000000000b' where id = '17600000-0000-0000-0000-000000000013';
set local request.jwt.claims = '{"sub":"17600000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is((select count(*)::int from pcm.sso_listar_historico_estrutura('componente', '17600000-0000-0000-0000-000000000016', 50, null, null)), 0, 'histórico de origem sem Cliente não é exposto automaticamente');
select is((select count(*)::int from pcm.sso_listar_historico_estrutura('componente', '17600000-0000-0000-0000-000000000013', 50, null, null)), 0, 'histórico entre Clientes exige acesso aos dois escopos');
select throws_ok($$ select * from pcm.sso_listar_historico_estrutura('componente', '17600000-0000-0000-0000-000000000012', 50, null, null) $$, '42501', null, 'histórico de outro Cliente é negado');
reset role;
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('17600000-0000-0000-0000-000000000001', 'cadastro.ler', '17600000-0000-0000-0000-00000000000a');
set local role authenticated;
select ok((select count(*) > 0 from pcm.sso_listar_historico_estrutura('componente', '17600000-0000-0000-0000-000000000012', 50, null, null)), 'usuário com acesso atual consulta histórico do Componente');
select is((select count(*)::int from pcm.sso_listar_historico_estrutura('componente', '17600000-0000-0000-0000-000000000013', 50, null, null)), 2, 'acesso aos dois Clientes libera os movimentos entre eles');
reset role;
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('17600000-0000-0000-0000-000000000001', 'cadastro.gerir', '17600000-0000-0000-0000-00000000000a');
set local role authenticated;
select is((select count(*)::int from pcm.sso_listar_destinos_estrutura('17600000-0000-0000-0000-00000000000a', 'area', 2, null, null)), 2, 'seletores limitam página de Áreas');
select is((select count(*)::int from pcm.sso_listar_destinos_estrutura('17600000-0000-0000-0000-00000000000a', 'area', 20, '17600000-0000-0000-0000-000000000023', null)), 1, 'cursor recupera próxima página sem repetir');
select is((select count(*)::int from pcm.sso_listar_destinos_estrutura('17600000-0000-0000-0000-00000000000a', 'componente', 20, null, 'Raiz B')), 0, 'busca não inclui Componente de outro Cliente');
select throws_ok($$ select * from pcm.sso_listar_destinos_estrutura('17600000-0000-0000-0000-00000000000b', 'area', 20, null, null) $$, '42501', null, 'seletores exigem gestão no Cliente solicitado');
select throws_ok($$ select * from pcm.sso_listar_destinos_estrutura('17600000-0000-0000-0000-00000000000a', null, 20, null, null) $$, '22023', null, 'tipo ausente é recusado');
select lives_ok($$ select pcm.sso_mover_componente('17600000-0000-0000-0000-000000000101', 2, '17600000-0000-0000-0000-000000000012', '17600000-0000-0000-0000-000000000024', '17600000-0000-0000-0000-000000000031', '17600000-0000-0000-0000-000000000011') $$, 'gestor movimenta Componente com revisão atual');
select is((pcm.sso_mover_componente('17600000-0000-0000-0000-000000000101', 2, '17600000-0000-0000-0000-000000000012', '17600000-0000-0000-0000-000000000024', '17600000-0000-0000-0000-000000000031', '17600000-0000-0000-0000-000000000011') ->> 'revision')::int, 3, 'repetição retorna resultado original sem nova revisão');
select throws_ok($$ select pcm.sso_mover_componente('17600000-0000-0000-0000-000000000102', 2, '17600000-0000-0000-0000-000000000012', '17600000-0000-0000-0000-000000000024', '17600000-0000-0000-0000-000000000031', null) $$, '40001', null, 'revisão antiga não sobrescreve mudança');
select throws_ok($$ select pcm.sso_mover_componente('17600000-0000-0000-0000-000000000103', 1, '17600000-0000-0000-0000-000000000013', null, null, null) $$, '42501', null, 'gestão de outro Cliente exige concessão');
select throws_ok($$ select pcm.sso_mover_componente('17600000-0000-0000-0000-000000000101', 2, '17600000-0000-0000-0000-000000000012', '17600000-0000-0000-0000-000000000024', '17600000-0000-0000-0000-000000000031', null) $$, '23505', null, 'requestId não admite conteúdo diferente');
reset role;
select is((select count(*)::int from audit.events where entity = 'equipamentos' and entity_id = '17600000-0000-0000-0000-000000000012' and action = 'estrutura.comando'), 1, 'repetição não duplica evento do comando');
update pcm.equipamentos set estrutura_revisao = 999 where id = '17600000-0000-0000-0000-000000000012';
select is((select estrutura_revisao from pcm.equipamentos where id = '17600000-0000-0000-0000-000000000012'), 3, 'escrita direta não pode forjar revisão estrutural');
update pcm.equipamentos set ativo = false where id = '17600000-0000-0000-0000-000000000011';
set local role authenticated;
select is((pcm.sso_mover_componente('17600000-0000-0000-0000-000000000101', 2, '17600000-0000-0000-0000-000000000012', '17600000-0000-0000-0000-000000000024', '17600000-0000-0000-0000-000000000031', '17600000-0000-0000-0000-000000000011') ->> 'revision')::int, 3, 'retry retorna resultado mesmo quando pai foi desativado depois');
reset role;
update pcm.equipamentos set ativo = true where id = '17600000-0000-0000-0000-000000000011';
select is((select estrutura_revisao from pcm.equipamentos where id = '17600000-0000-0000-0000-000000000011'), 3, 'mudanças estruturais legadas incrementam revisão');
update pcm.equipamentos set client_id = '17600000-0000-0000-0000-00000000000b', area_id = null, local_id = null, parent_item_id = null where id = '17600000-0000-0000-0000-000000000012';
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values ('17600000-0000-0000-0000-000000000001', 'cadastro.gerir', '17600000-0000-0000-0000-00000000000b');
update config.sso_concessoes set ativa = false where usuario_id = '17600000-0000-0000-0000-000000000001' and acao = 'cadastro.gerir' and cliente_id = '17600000-0000-0000-0000-00000000000a';
set local role authenticated;
select throws_ok($$ select pcm.sso_mover_componente('17600000-0000-0000-0000-000000000101', 2, '17600000-0000-0000-0000-000000000012', '17600000-0000-0000-0000-000000000024', '17600000-0000-0000-0000-000000000031', '17600000-0000-0000-0000-000000000011') $$, '42501', null, 'retry exige acesso atual ao Cliente original e ao atual');
reset role;
select * from finish();
rollback;
