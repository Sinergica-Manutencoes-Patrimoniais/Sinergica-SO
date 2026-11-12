-- E01-S183 (Portal operacional do Cliente) — primeira prova de isolamento entre Clientes.
-- A story tinha 40 migrations e ZERO arquivo de teste, numa superfície voltada ao cliente final
-- (síndico), onde um vazamento entre Clientes é o pior defeito possível. Depois da migration 1839
-- essas RPCs passaram a ser alcançáveis por `authenticated`, então o isolamento precisa estar
-- provado por teste, não por inspeção.
--
-- Prova que `pcm.sso_portal_calendario_visitas` só devolve publicações do Cliente a que o síndico
-- está vinculado em `config.usuario_cliente`, e que papel/vínculo/gate/revogação são todos
-- condições necessárias.
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18300000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's183-sindico-a@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18300000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's183-sindico-b@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18300000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's183-colaborador@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18300000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's183-sindico-inativo@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18300000-0000-4000-8000-000000000001', 'cliente-sindico', 'Síndico A', true),
 ('18300000-0000-4000-8000-000000000002', 'cliente-sindico', 'Síndico B', true),
 ('18300000-0000-4000-8000-000000000003', 'colaborador', 'Colaborador vinculado', true),
 ('18300000-0000-4000-8000-000000000004', 'cliente-sindico', 'Síndico inativo', false);
-- `config.usuario_cliente` tem unique em cliente_id: um usuário de portal por Cliente. Por isso
-- os casos de papel errado e de usuário inativo precisam dos seus próprios Clientes (C e D).
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18300000-0000-4000-8000-00000000000a', 'Cliente A', true, '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000000b', 'Cliente B', true, '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000000c', 'Cliente C', true, '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000000d', 'Cliente D', true, '18300000-0000-4000-8000-000000000001');
insert into config.usuario_cliente (user_id, cliente_id) values
 ('18300000-0000-4000-8000-000000000001', '18300000-0000-4000-8000-00000000000a'),
 ('18300000-0000-4000-8000-000000000002', '18300000-0000-4000-8000-00000000000b'),
 ('18300000-0000-4000-8000-000000000003', '18300000-0000-4000-8000-00000000000c'),
 ('18300000-0000-4000-8000-000000000004', '18300000-0000-4000-8000-00000000000d');

insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('18300000-0000-4000-8000-00000000001a', 'CH-S183-A', '18300000-0000-4000-8000-00000000000a', 'Chamado A', '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000001b', 'CH-S183-B', '18300000-0000-4000-8000-00000000000b', 'Chamado B', '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000001e', 'CH-S183-A2', '18300000-0000-4000-8000-00000000000a', 'Chamado A2 (publicação revogada)', '18300000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, created_by) values
 ('18300000-0000-4000-8000-00000000002a', '18300000-0000-4000-8000-00000000000a', '18300000-0000-4000-8000-00000000001a', 'OS-S183-A', 'OS do Cliente A', 'corretiva', 'em_execucao', '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000002b', '18300000-0000-4000-8000-00000000000b', '18300000-0000-4000-8000-00000000001b', 'OS-S183-B', 'OS do Cliente B', 'corretiva', 'em_execucao', '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000002e', '18300000-0000-4000-8000-00000000000a', '18300000-0000-4000-8000-00000000001e', 'OS-S183-A2', 'OS do Cliente A (publicação revogada)', 'corretiva', 'em_execucao', '18300000-0000-4000-8000-000000000001');
insert into pcm.visitas (id, cliente_id, inicio_em, fim_em, fuso, natureza, estado, revisao, created_by) values
 ('18300000-0000-4000-8000-00000000003a', '18300000-0000-4000-8000-00000000000a', now() + interval '1 day', now() + interval '1 day 2 hours', 'America/Sao_Paulo', 'regular', 'planejada', 1, '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000003b', '18300000-0000-4000-8000-00000000000b', now() + interval '1 day', now() + interval '1 day 2 hours', 'America/Sao_Paulo', 'regular', 'planejada', 1, '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000003c', '18300000-0000-4000-8000-00000000000a', now() + interval '2 days', now() + interval '2 days 2 hours', 'America/Sao_Paulo', 'regular', 'planejada', 1, '18300000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico (id, visita_id, os_id, cliente_id, sequencia, created_by) values
 ('18300000-0000-4000-8000-00000000004a', '18300000-0000-4000-8000-00000000003a', '18300000-0000-4000-8000-00000000002a', '18300000-0000-4000-8000-00000000000a', 1, '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000004b', '18300000-0000-4000-8000-00000000003b', '18300000-0000-4000-8000-00000000002b', '18300000-0000-4000-8000-00000000000b', 1, '18300000-0000-4000-8000-000000000001'),
 ('18300000-0000-4000-8000-00000000004c', '18300000-0000-4000-8000-00000000003c', '18300000-0000-4000-8000-00000000002e', '18300000-0000-4000-8000-00000000000a', 1, '18300000-0000-4000-8000-000000000001');
insert into pcm.portal_visita_publicacoes (id, cliente_id, visita_id, os_id, revisao_visita, inicio_em, fim_em, mensagem, publicado_por, revogado_em, revogado_por) values
 ('18300000-0000-4000-8000-00000000005a', '18300000-0000-4000-8000-00000000000a', '18300000-0000-4000-8000-00000000003a', '18300000-0000-4000-8000-00000000002a', 1, now() + interval '1 day', now() + interval '1 day 2 hours', 'Visita do Cliente A', '18300000-0000-4000-8000-000000000001', null, null),
 ('18300000-0000-4000-8000-00000000005b', '18300000-0000-4000-8000-00000000000b', '18300000-0000-4000-8000-00000000003b', '18300000-0000-4000-8000-00000000002b', 1, now() + interval '1 day', now() + interval '1 day 2 hours', 'Visita do Cliente B', '18300000-0000-4000-8000-000000000001', null, null),
 ('18300000-0000-4000-8000-00000000005c', '18300000-0000-4000-8000-00000000000a', '18300000-0000-4000-8000-00000000003c', '18300000-0000-4000-8000-00000000002e', 1, now() + interval '2 days', now() + interval '2 days 2 hours', 'Visita revogada do Cliente A', '18300000-0000-4000-8000-000000000001', now(), '18300000-0000-4000-8000-000000000001');

-- Gate fechado por padrão: nem o síndico legítimo lê.
set local request.jwt.claims = '{"sub":"18300000-0000-4000-8000-000000000001","role":"authenticated","user_role":"cliente-sindico"}';
set local role authenticated;
select throws_ok(
  format($f$ select * from pcm.sso_portal_calendario_visitas(%L, now(), now() + interval '30 days') $f$,
    '18300000-0000-4000-8000-00000000000a'),
  '42501', 'sem_acesso', 'gate do portal fechado por padrão recusa até o síndico legítimo'
);

reset role;
update pcm.portal_visita_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18300000-0000-4000-8000-000000000001","role":"authenticated","user_role":"cliente-sindico"}';
set local role authenticated;

select is(
  (select count(*)::int from pcm.sso_portal_calendario_visitas('18300000-0000-4000-8000-00000000000a', now(), now() + interval '30 days')),
  1, 'síndico de A vê exatamente a publicação ativa de A (a revogada não entra)'
);
select is(
  (select os_numero from pcm.sso_portal_calendario_visitas('18300000-0000-4000-8000-00000000000a', now(), now() + interval '30 days') limit 1),
  'CH-S183-A', 'o dado devolvido é o do próprio Cliente (o trigger legado 1:1 copia o número do Chamado para a OS)'
);
select is(
  (select count(*)::int from pcm.sso_portal_calendario_visitas('18300000-0000-4000-8000-00000000000a', now(), now() + interval '30 days')
    where os_numero = 'CH-S183-B'),
  0, 'nenhuma linha do Cliente B aparece para o síndico de A'
);

-- O ataque central: síndico de A pedindo explicitamente o calendário do Cliente B.
select throws_ok(
  format($f$ select * from pcm.sso_portal_calendario_visitas(%L, now(), now() + interval '30 days') $f$,
    '18300000-0000-4000-8000-00000000000b'),
  '42501', 'sem_acesso', 'síndico de A nunca lê o calendário do Cliente B, mesmo pedindo direto'
);

select throws_ok(
  format($f$ select * from pcm.sso_portal_calendario_visitas(%L, now(), now() - interval '1 day') $f$,
    '18300000-0000-4000-8000-00000000000a'),
  '22023', 'periodo_invalido', 'período invertido é recusado'
);
select throws_ok(
  format($f$ select * from pcm.sso_portal_calendario_visitas(%L, now(), now() + interval '400 days') $f$,
    '18300000-0000-4000-8000-00000000000a'),
  '22023', 'periodo_invalido', 'janela maior que 370 dias é recusada'
);

-- Papel errado: vinculado ao Cliente A, mas não é síndico.
reset role;
set local request.jwt.claims = '{"sub":"18300000-0000-4000-8000-000000000003","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select * from pcm.sso_portal_calendario_visitas(%L, now(), now() + interval '30 days') $f$,
    '18300000-0000-4000-8000-00000000000c'),
  '42501', 'sem_acesso', 'vínculo com o Cliente não basta: o portal exige papel cliente-sindico'
);

-- Síndico inativo continua vinculado, mas não lê.
reset role;
set local request.jwt.claims = '{"sub":"18300000-0000-4000-8000-000000000004","role":"authenticated","user_role":"cliente-sindico"}';
set local role authenticated;
select throws_ok(
  format($f$ select * from pcm.sso_portal_calendario_visitas(%L, now(), now() + interval '30 days') $f$,
    '18300000-0000-4000-8000-00000000000d'),
  '42501', 'sem_acesso', 'síndico inativo perde o acesso ao portal'
);

-- Sem identidade nenhuma.
reset role;
select throws_ok(
  format($f$ select * from pcm.sso_portal_calendario_visitas(%L, now(), now() + interval '30 days') $f$,
    '18300000-0000-4000-8000-00000000000a'),
  '42501', 'sem_acesso', 'sem auth.uid() não há leitura do portal'
);

select * from finish();
rollback;
