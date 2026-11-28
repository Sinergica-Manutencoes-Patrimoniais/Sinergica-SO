-- E01-S207_portal_satisfacao_finalizada.test.sql — pgTAP
-- O síndico avalia OS finalizada do próprio Cliente; nada além disso.
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000002071', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-s207@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;
insert into config.usuarios (user_id, papel, nome) values ('00000000-0000-0000-0000-000000002071', 'cliente-sindico', 'Síndico S207') on conflict (user_id) do nothing;
insert into pcm.clientes (id, nome, created_by) values
  ('00000000-0000-0000-0000-0000000020a7', '[TESTE] Condomínio A S207', '00000000-0000-0000-0000-000000002071'),
  ('00000000-0000-0000-0000-0000000020b7', '[TESTE] Condomínio B S207', '00000000-0000-0000-0000-000000002071');
insert into config.usuario_cliente (user_id, cliente_id) values ('00000000-0000-0000-0000-000000002071', '00000000-0000-0000-0000-0000000020a7');

insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, created_by) values
  ('00000000-0000-0000-0000-0000000020d1', '00000000-0000-0000-0000-0000000020a7', 'OS-S207-1', '[TESTE] finalizada', 'corretiva', 'solicitacao', '00000000-0000-0000-0000-000000002071'),
  ('00000000-0000-0000-0000-0000000020d2', '00000000-0000-0000-0000-0000000020a7', 'OS-S207-2', '[TESTE] aberta', 'corretiva', 'solicitacao', '00000000-0000-0000-0000-000000002071'),
  ('00000000-0000-0000-0000-0000000020d3', '00000000-0000-0000-0000-0000000020a7', 'OS-S207-3', '[TESTE] cancelada', 'corretiva', 'solicitacao', '00000000-0000-0000-0000-000000002071'),
  ('00000000-0000-0000-0000-0000000020d4', '00000000-0000-0000-0000-0000000020b7', 'OS-S207-4', '[TESTE] finalizada de B', 'corretiva', 'solicitacao', '00000000-0000-0000-0000-000000002071');
-- o ciclo de status é validado por trigger: força o estado final direto
alter table pcm.ordens_servico disable trigger user;
update pcm.ordens_servico set status = 'finalizado' where id in ('00000000-0000-0000-0000-0000000020d1','00000000-0000-0000-0000-0000000020d4');
update pcm.ordens_servico set status = 'cancelado' where id = '00000000-0000-0000-0000-0000000020d3';
alter table pcm.ordens_servico enable trigger user;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000002071","role":"authenticated","user_role":"cliente-sindico","cliente_id":"00000000-0000-0000-0000-0000000020a7","user_modulos":{"area-cliente":"leitura"}}';

select lives_ok($$ insert into pcm.portal_satisfacao (ordem_servico_id, cliente_id, csat, nps, created_by)
  values ('00000000-0000-0000-0000-0000000020d1','00000000-0000-0000-0000-0000000020a7',5,10,'00000000-0000-0000-0000-000000002071') $$,
  'síndico avalia OS finalizada do próprio Cliente');
select throws_ok($$ insert into pcm.portal_satisfacao (ordem_servico_id, cliente_id, csat, nps, created_by)
  values ('00000000-0000-0000-0000-0000000020d1','00000000-0000-0000-0000-0000000020a7',1,0,'00000000-0000-0000-0000-000000002071') $$,
  '23505', null, 'segunda avaliação da mesma OS: negada (uma por OS)');
select throws_ok($$ insert into pcm.portal_satisfacao (ordem_servico_id, cliente_id, csat, created_by)
  values ('00000000-0000-0000-0000-0000000020d2','00000000-0000-0000-0000-0000000020a7',5,'00000000-0000-0000-0000-000000002071') $$,
  '42501', null, 'OS aberta: negada');
select throws_ok($$ insert into pcm.portal_satisfacao (ordem_servico_id, cliente_id, csat, created_by)
  values ('00000000-0000-0000-0000-0000000020d3','00000000-0000-0000-0000-0000000020a7',5,'00000000-0000-0000-0000-000000002071') $$,
  '42501', null, 'OS cancelada: negada');
select throws_ok($$ insert into pcm.portal_satisfacao (ordem_servico_id, cliente_id, csat, created_by)
  values ('00000000-0000-0000-0000-0000000020d4','00000000-0000-0000-0000-0000000020b7',5,'00000000-0000-0000-0000-000000002071') $$,
  '42501', null, 'OS finalizada de outro Cliente (cliente_id de B): negada');
select throws_ok($$ insert into pcm.portal_satisfacao (ordem_servico_id, cliente_id, csat, created_by)
  values ('00000000-0000-0000-0000-0000000020d4','00000000-0000-0000-0000-0000000020a7',5,'00000000-0000-0000-0000-000000002071') $$,
  '42501', null, 'OS de B declarando cliente_id de A: negada');

-- Revogação imediata (ADR-1691): JWT ainda válido, mas usuário desativado: negado.
reset role;
update config.usuarios set ativo = false where user_id = '00000000-0000-0000-0000-000000002071';
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, created_by)
  values ('00000000-0000-0000-0000-0000000020d5', '00000000-0000-0000-0000-0000000020a7', 'OS-S207-5', '[TESTE] finalizada 2', 'corretiva', 'solicitacao', '00000000-0000-0000-0000-000000002071');
alter table pcm.ordens_servico disable trigger user;
update pcm.ordens_servico set status = 'finalizado' where id = '00000000-0000-0000-0000-0000000020d5';
alter table pcm.ordens_servico enable trigger user;
set local role authenticated;
select throws_ok($$ insert into pcm.portal_satisfacao (ordem_servico_id, cliente_id, csat, created_by)
  values ('00000000-0000-0000-0000-0000000020d5','00000000-0000-0000-0000-0000000020a7',5,'00000000-0000-0000-0000-000000002071') $$,
  '42501', null, 'síndico revogado com JWT ainda válido: negado');
reset role;
update config.usuarios set ativo = true where user_id = '00000000-0000-0000-0000-000000002071';
delete from config.usuario_cliente where user_id = '00000000-0000-0000-0000-000000002071';
set local role authenticated;
select throws_ok($$ insert into pcm.portal_satisfacao (ordem_servico_id, cliente_id, csat, created_by)
  values ('00000000-0000-0000-0000-0000000020d5','00000000-0000-0000-0000-0000000020a7',5,'00000000-0000-0000-0000-000000002071') $$,
  '42501', null, 'vínculo com o Cliente removido, JWT ainda válido: negado');
reset role;
insert into config.usuario_cliente (user_id, cliente_id) values ('00000000-0000-0000-0000-000000002071', '00000000-0000-0000-0000-0000000020a7');

set local role anon;
select throws_ok($$ insert into pcm.portal_satisfacao (ordem_servico_id, cliente_id, csat, created_by)
  values ('00000000-0000-0000-0000-0000000020d1','00000000-0000-0000-0000-0000000020a7',5,'00000000-0000-0000-0000-000000002071') $$,
  '42501', null, 'anon: negado');
reset role;
select is((select count(*) from pcm.portal_satisfacao where cliente_id = '00000000-0000-0000-0000-0000000020a7'), 1::bigint, 'só a avaliação válida foi gravada');
select * from finish();
rollback;
