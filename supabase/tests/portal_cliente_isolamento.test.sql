-- portal_cliente_isolamento.test.sql — pgTAP E09-S01..S10
-- Gate crítico: cliente-sindico só alcança linhas do cliente_id do JWT.

begin;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-a-e09@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-b-e09@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-sem-vinculo-e09@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into config.usuarios (user_id, papel, nome) values
  ('90000000-0000-0000-0000-000000000001', 'cliente-sindico', 'Síndico A'),
  ('90000000-0000-0000-0000-000000000002', 'cliente-sindico', 'Síndico B'),
  ('90000000-0000-0000-0000-000000000003', 'cliente-sindico', 'Síndico sem vínculo')
on conflict (user_id) do nothing;

insert into pcm.clientes (id, nome, created_by) values
  ('90000000-0000-0000-0000-0000000000a1', '[TESTE] Condomínio A', '90000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-0000000000b1', '[TESTE] Condomínio B', '90000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into config.usuario_cliente (user_id, cliente_id) values
  ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-0000000000a1'),
  ('90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-0000000000b1');

insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, status, prioridade, origem, created_by) values
  ('90000000-0000-0000-0000-0000000000a2', '90000000-0000-0000-0000-0000000000a1', 'OS-E09-A', 'OS A', 'corretiva', 'solicitacao', 'normal', 'manual', '90000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-0000000000b2', '90000000-0000-0000-0000-0000000000b1', 'OS-E09-B', 'OS B', 'corretiva', 'solicitacao', 'normal', 'manual', '90000000-0000-0000-0000-000000000002');

insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, cliente_id, descricao)
select '90000000-0000-0000-0000-0000000000f1', 'entrada', 'previsto', 10000, current_date, current_date + 10, id, '90000000-0000-0000-0000-0000000000a1', 'Fatura A'
from financeiro.categorias where tipo = 'entrada' limit 1;
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, cliente_id, descricao)
select '90000000-0000-0000-0000-0000000000f2', 'entrada', 'previsto', 20000, current_date, current_date + 10, id, '90000000-0000-0000-0000-0000000000b1', 'Fatura B'
from financeiro.categorias where tipo = 'entrada' limit 1;

select is(
  config.custom_access_token_hook(jsonb_build_object('user_id','90000000-0000-0000-0000-000000000001','claims','{"role":"authenticated"}'::jsonb)) #>> '{claims,cliente_id}',
  '90000000-0000-0000-0000-0000000000a1',
  'AC-2: hook injeta cliente_id do vínculo'
);
select is(
  config.custom_access_token_hook(jsonb_build_object('user_id','90000000-0000-0000-0000-000000000003','claims','{"role":"authenticated"}'::jsonb)) #>> '{claims,cliente_id}',
  null,
  'AC-2: hook não injeta cliente_id sem vínculo'
);
select is(
  (select nivel from config.resolver_permissoes_modulo('90000000-0000-0000-0000-000000000001') where modulo = 'area-cliente'),
  'leitura',
  'AC-4: resolver concede area-cliente leitura'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated","user_role":"cliente-sindico","cliente_id":"90000000-0000-0000-0000-0000000000a1","user_modulos":{"area-cliente":"leitura"}}';

select is((select count(*) from pcm.clientes), 1::bigint, 'AC-3: síndico A vê exatamente um cliente');
select is((select nome from pcm.clientes), '[TESTE] Condomínio A', 'AC-3: linha visível pertence a A');
select is((select count(*) from pcm.ordens_servico), 1::bigint, 'E09-S05: síndico A vê só OS de A');
select is((select numero from pcm.ordens_servico), 'OS-E09-A', 'E09-S05: OS de B não vaza');

select lives_ok(
  $$ insert into pcm.chamados (numero, cliente_id, titulo, origem, created_by)
     values ('CH-E09-A', '90000000-0000-0000-0000-0000000000a1', 'Chamado portal A', 'cliente_portal', '90000000-0000-0000-0000-000000000001') $$,
  'E09-S04: síndico cria chamado próprio com origem cliente_portal'
);
select lives_ok(
  $$ insert into pcm.chamados_eventos (chamado_id, tipo, metadata, created_by)
     select id, 'criado', '{}'::jsonb, '90000000-0000-0000-0000-000000000001'
       from pcm.chamados where numero = 'CH-E09-A' $$,
  'E09-S04: síndico registra evento inicial append-only no próprio chamado'
);
select throws_ok(
  $$ insert into pcm.chamados (numero, cliente_id, titulo, origem, created_by)
     values ('CH-E09-B', '90000000-0000-0000-0000-0000000000b1', 'Tentativa B', 'cliente_portal', '90000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'E09-S04: síndico não cria chamado para outro cliente'
);
select lives_ok(
  $$ insert into pcm.os_notas (ordem_servico_id, cliente_id, mensagem, autor_tipo, created_by)
     values ('90000000-0000-0000-0000-0000000000a2', '90000000-0000-0000-0000-0000000000a1', 'Nota A', 'cliente', '90000000-0000-0000-0000-000000000001') $$,
  'E09-S05: nota append-only aceita na OS própria'
);
select throws_ok(
  $$ insert into pcm.os_notas (ordem_servico_id, cliente_id, mensagem, autor_tipo, created_by)
     values ('90000000-0000-0000-0000-0000000000b2', '90000000-0000-0000-0000-0000000000b1', 'Tentativa B', 'cliente', '90000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'E09-S05: nota em OS de outro cliente é negada'
);
select is((select count(*) from financeiro.portal_faturas), 1::bigint, 'E09-S10: view mostra só fatura de A');
select is((select count(*) from financeiro.lancamentos), 0::bigint, 'E09-S10: tabela financeira crua continua negada');

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated","user_role":"cliente-sindico","user_modulos":{"area-cliente":"leitura"}}';
select is((select count(*) from pcm.clientes), 0::bigint, 'AC-3: síndico sem cliente_id vê zero linhas');
select throws_ok(
  $$ select pcm.portal_decidir_orcamento(gen_random_uuid(), 'aprovado', null) $$,
  '42501', 'somente_cliente_sindico',
  'E09-S09: síndico sem cliente_id não decide orçamento'
);

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select pcm.portal_decidir_orcamento(gen_random_uuid(), 'aprovado', null) $$,
  '42501', 'somente_cliente_sindico',
  'E09-S09: authenticated sem claims de portal não decide orçamento'
);

reset role;
select * from finish();
rollback;
