begin;
select plan(15);
select has_function('pcm', 'sso_consultar_finalizacao_os_por_pedido',
  array['uuid', 'uuid', 'uuid', 'uuid', 'integer', 'text', 'timestamp with time zone'],
  'consulta de reconciliação existe');
select ok(not has_function_privilege('anon', 'pcm.sso_consultar_finalizacao_os_por_pedido(uuid,uuid,uuid,uuid,integer,text,timestamptz)', 'EXECUTE'),
  'usuário anônimo não consulta resultado');
select ok(not has_function_privilege('authenticated', 'pcm.sso_consultar_finalizacao_os_por_pedido(uuid,uuid,uuid,uuid,integer,text,timestamptz)', 'EXECUTE'),
  'consulta permanece fechada até homologação');
select has_function('pcm', 'sso_finalizar_os_validada_v2',
  array['uuid', 'uuid', 'uuid', 'uuid', 'uuid', 'integer', 'text', 'timestamp with time zone'],
  'finalização exige OS conferida');
select ok(not has_function_privilege('authenticated', 'pcm.sso_finalizar_os_validada_v2(uuid,uuid,uuid,uuid,uuid,integer,text,timestamptz)', 'EXECUTE'),
  'finalização nova permanece fechada até homologação');
select throws_ok($$ select pcm.sso_consultar_finalizacao_os_por_pedido(
  '16800000-0000-4000-8000-000000000003','16800000-0000-4000-8000-000000000001',
  '16800000-0000-4000-8000-000000000002','16800000-0000-4000-8000-000000000005',1,'em_execucao',now()) $$,
  '55000', null, 'consulta respeita gate fechado');
select throws_ok($$ select pcm.sso_finalizar_os_validada_v2(null,null,null,null,null,1,'em_execucao',now()) $$,
  '55000', null, 'wrapper respeita gate fechado antes de operar');

-- Fixtures sintéticas: FKs das entidades não usadas são dispensadas somente durante inserção.
-- Triggers normais são restaurados antes das chamadas; tudo é revertido no fim.
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16890000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gestor-reconciliacao@test.local',crypt('x', gen_salt('bf')),'{}','{}',now(),now()),
 ('16890000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outro-reconciliacao@test.local',crypt('x', gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('16890000-0000-4000-8000-000000000001','superadmin','Gestor fixture',true),
 ('16890000-0000-4000-8000-000000000002','superadmin','Outro fixture',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('16890000-0000-4000-8000-00000000000a','Cliente A fixture',true,'16890000-0000-4000-8000-000000000001'),
 ('16890000-0000-4000-8000-00000000000b','Cliente B fixture',true,'16890000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16890000-0000-4000-8000-000000000001','execucao.validar','16890000-0000-4000-8000-00000000000a'),
 ('16890000-0000-4000-8000-000000000002','execucao.validar','16890000-0000-4000-8000-00000000000a');
set local session_replication_role = replica;
insert into pcm.retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem) values
 ('16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-00000000000a','16890000-0000-4000-8000-000000000020',
  '16890000-0000-4000-8000-000000000030','16890000-0000-4000-8000-000000000040','reconciliacao-fixture','manual_declarado');
insert into pcm.sso_finalizacoes_os_validadas(request_id,retorno_id,os_id,atestacao_request_id,revisao_decisao,payload,resultado,ator_id)
values ('16890000-0000-4000-8000-000000000050','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000020',
 '16890000-0000-4000-8000-000000000060',3,
 jsonb_build_object('clienteId','16890000-0000-4000-8000-00000000000a'::uuid,'retornoId','16890000-0000-4000-8000-000000000010'::uuid,
 'atestacaoRequestId','16890000-0000-4000-8000-000000000060'::uuid,'expectedDecisao',3,'expectedStatus','em_execucao','expectedUpdatedAt','2026-10-01T10:00:00Z'::timestamptz),
 jsonb_build_object('retornoId','16890000-0000-4000-8000-000000000010'::uuid,'osId','16890000-0000-4000-8000-000000000020'::uuid,
 'requestId','16890000-0000-4000-8000-000000000050'::uuid,'status','finalizado','chamadoAlterado',false),
 '16890000-0000-4000-8000-000000000001');
set local session_replication_role = origin;
update pcm.sso_finalizar_os_validada_gate set habilitado=true where id;
update pcm.sso_atestacao_pcm_gate set habilitado=true where id;
grant execute on function pcm.sso_consultar_finalizacao_os_por_pedido(uuid,uuid,uuid,uuid,integer,text,timestamptz) to authenticated;
grant execute on function pcm.sso_finalizar_os_validada_v2(uuid,uuid,uuid,uuid,uuid,integer,text,timestamptz) to authenticated;
set local request.jwt.claims = '{"sub":"16890000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is((pcm.sso_consultar_finalizacao_os_por_pedido('16890000-0000-4000-8000-000000000050','16890000-0000-4000-8000-00000000000a','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000060',3,'em_execucao','2026-10-01T10:00:00Z')->>'situacao'), 'encontrada', 'resultado gravado pode ser recuperado');
select is((pcm.sso_consultar_finalizacao_os_por_pedido('16890000-0000-4000-8000-000000000050','16890000-0000-4000-8000-00000000000a','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000060',3,'em_execucao','2026-10-01T10:00:00Z')->'resultado'->>'osId'), '16890000-0000-4000-8000-000000000020', 'resultado preserva OS original');
select is(pcm.sso_consultar_finalizacao_os_por_pedido('16890000-0000-4000-8000-000000000050','16890000-0000-4000-8000-00000000000a','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000060',3,'em_execucao','2026-10-01T10:00:00Z'), pcm.sso_consultar_finalizacao_os_por_pedido('16890000-0000-4000-8000-000000000050','16890000-0000-4000-8000-00000000000a','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000060',3,'em_execucao','2026-10-01T10:00:00Z'), 'releitura é idempotente');
select is((pcm.sso_consultar_finalizacao_os_por_pedido('16890000-0000-4000-8000-000000000051','16890000-0000-4000-8000-00000000000a','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000060',3,'em_execucao','2026-10-01T10:00:00Z')->>'situacao'), 'nao_localizada', 'ausência fica indeterminada');
select throws_ok($$select pcm.sso_consultar_finalizacao_os_por_pedido('16890000-0000-4000-8000-000000000050','16890000-0000-4000-8000-00000000000a','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000060',3,'planejamento','2026-10-01T10:00:00Z')$$, '42501', null, 'payload divergente é negado');
select throws_ok($$select pcm.sso_consultar_finalizacao_os_por_pedido('16890000-0000-4000-8000-000000000050','16890000-0000-4000-8000-00000000000b','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000060',3,'em_execucao','2026-10-01T10:00:00Z')$$, '42501', null, 'outro Cliente é negado');
select throws_ok($$select pcm.sso_finalizar_os_validada_v2('16890000-0000-4000-8000-000000000051','16890000-0000-4000-8000-00000000000a','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000021','16890000-0000-4000-8000-000000000060',3,'em_execucao','2026-10-01T10:00:00Z')$$, '40001', null, 'wrapper bloqueia OS divergente antes da transição');
set local request.jwt.claims = '{"sub":"16890000-0000-4000-8000-000000000002","role":"authenticated","user_role":"superadmin"}';
select throws_ok($$select pcm.sso_consultar_finalizacao_os_por_pedido('16890000-0000-4000-8000-000000000050','16890000-0000-4000-8000-00000000000a','16890000-0000-4000-8000-000000000010','16890000-0000-4000-8000-000000000060',3,'em_execucao','2026-10-01T10:00:00Z')$$, '42501', null, 'outro ator mesmo com capacidade não lê pedido');
reset role;
select * from finish();
rollback;
