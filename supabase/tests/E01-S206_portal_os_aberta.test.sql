-- E01-S206_portal_os_aberta.test.sql — pgTAP
-- O Portal do Cliente conta "OS em andamento" pela mesma classificação da migration 1913
-- (pcm.fn_contagem_operacional_por_cliente), sob RLS do síndico: finalizada e cancelada ficam
-- fora, aberta dentro, e nada de outro Cliente aparece.
begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000002061', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-s206@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into config.usuarios (user_id, papel, nome) values
  ('00000000-0000-0000-0000-000000002061', 'cliente-sindico', 'Síndico S206')
on conflict (user_id) do nothing;

insert into pcm.clientes (id, nome, created_by) values
  ('00000000-0000-0000-0000-0000000020a6', '[TESTE] Condomínio A S206', '00000000-0000-0000-0000-000000002061'),
  ('00000000-0000-0000-0000-0000000020b6', '[TESTE] Condomínio B S206', '00000000-0000-0000-0000-000000002061');

insert into config.usuario_cliente (user_id, cliente_id) values
  ('00000000-0000-0000-0000-000000002061', '00000000-0000-0000-0000-0000000020a6');

insert into pcm.chamados (id, numero, cliente_id, titulo, status, created_by) values
  ('00000000-0000-0000-0000-0000000020c1', 'CH-S206-1', '00000000-0000-0000-0000-0000000020a6', '[TESTE] Chamado OS aberta', 'convertido_os', '00000000-0000-0000-0000-000000002061'),
  ('00000000-0000-0000-0000-0000000020c2', 'CH-S206-2', '00000000-0000-0000-0000-0000000020a6', '[TESTE] Chamado OS finalizada', 'convertido_os', '00000000-0000-0000-0000-000000002061'),
  ('00000000-0000-0000-0000-0000000020c3', 'CH-S206-3', '00000000-0000-0000-0000-0000000020a6', '[TESTE] Chamado OS cancelada', 'convertido_os', '00000000-0000-0000-0000-000000002061'),
  ('00000000-0000-0000-0000-0000000020c4', 'CH-S206-4', '00000000-0000-0000-0000-0000000020b6', '[TESTE] Chamado do Cliente B', 'convertido_os', '00000000-0000-0000-0000-000000002061');

insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, created_by) values
  ('00000000-0000-0000-0000-0000000020d1', '00000000-0000-0000-0000-0000000020a6', '00000000-0000-0000-0000-0000000020c1', 'OS-S206-1', '[TESTE] OS aberta', 'corretiva', 'solicitacao', '00000000-0000-0000-0000-000000002061'),
  ('00000000-0000-0000-0000-0000000020d2', '00000000-0000-0000-0000-0000000020a6', '00000000-0000-0000-0000-0000000020c2', 'OS-S206-2', '[TESTE] OS finalizada', 'corretiva', 'finalizado', '00000000-0000-0000-0000-000000002061'),
  ('00000000-0000-0000-0000-0000000020d3', '00000000-0000-0000-0000-0000000020a6', '00000000-0000-0000-0000-0000000020c3', 'OS-S206-3', '[TESTE] OS cancelada', 'corretiva', 'cancelado', '00000000-0000-0000-0000-000000002061'),
  ('00000000-0000-0000-0000-0000000020d4', '00000000-0000-0000-0000-0000000020b6', '00000000-0000-0000-0000-0000000020c4', 'OS-S206-4', '[TESTE] OS aberta do Cliente B', 'corretiva', 'solicitacao', '00000000-0000-0000-0000-000000002061');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000002061","role":"authenticated","user_role":"cliente-sindico","cliente_id":"00000000-0000-0000-0000-0000000020a6","user_modulos":{"area-cliente":"leitura"}}';

-- Permitido: o síndico recebe a contagem do próprio Cliente, aberta separada de finalizada/cancelada.
select results_eq(
  $$ select os_abertas from pcm.fn_contagem_operacional_por_cliente('00000000-0000-0000-0000-0000000020a6') $$,
  $$ values (1::bigint) $$,
  'síndico A: 1 OS aberta (finalizada e cancelada fora)'
);
select is(
  (select count(*) from pcm.operacao_itens where ordem_servico_id = '00000000-0000-0000-0000-0000000020d2' and status = 'finalizado'),
  1::bigint, 'a OS finalizada existe para o síndico (o RLS não mudou), mas não conta como aberta'
);
select is(
  (select count(*) from pcm.operacao_itens where ordem_servico_id = '00000000-0000-0000-0000-0000000020d3' and status = 'cancelado'),
  1::bigint, 'a OS cancelada existe para o síndico, mas não conta como aberta'
);

-- Negado: nada do Cliente B.
select is(
  (select count(*) from pcm.fn_contagem_operacional_por_cliente('00000000-0000-0000-0000-0000000020b6')),
  0::bigint, 'síndico A não recebe contagem do Cliente B'
);
select is(
  (select count(*) from pcm.fn_contagem_operacional_por_cliente(null)),
  1::bigint, 'sem filtro, o síndico A recebe só a linha do próprio Cliente'
);
select is(
  (select count(*) from pcm.operacao_itens where ordem_servico_id = '00000000-0000-0000-0000-0000000020d4'),
  0::bigint, 'OS do Cliente B continua invisível'
);

-- Anônimo sem execute.
reset role;
set local role anon;
select throws_ok(
  $$ select * from pcm.fn_contagem_operacional_por_cliente(null) $$,
  '42501', null, 'anon não executa a contagem'
);

select * from finish();
rollback;
