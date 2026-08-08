-- E01-S135 — uma versão publicada só pode ser lida pelo condomínio do claim.
begin;
select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000d135', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'relatorio-interno@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000d136', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-a@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000d137', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-b@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values
  ('00000000-0000-0000-0000-00000000c135', '[TESTE] Cliente relatório A', '00000000-0000-0000-0000-00000000d135'),
  ('00000000-0000-0000-0000-00000000c136', '[TESTE] Cliente relatório B', '00000000-0000-0000-0000-00000000d135')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000d135","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
insert into pcm.relatorios_cliente_publicados (id, cliente_id, titulo, periodo_inicio, periodo_fim, conteudo, created_by)
values ('00000000-0000-0000-0000-00000000d138', '00000000-0000-0000-0000-00000000c135', 'Relatório A', '2026-08-01', '2026-08-31', '{"clienteNome":"Cliente A"}', '00000000-0000-0000-0000-00000000d135');
select is((select count(*) from pcm.relatorios_cliente_publicados), 1::bigint, 'interno PCM publica retrato imutável');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000d136","user_role":"cliente-sindico","cliente_id":"00000000-0000-0000-0000-00000000c135","user_modulos":{}}';
select is((select count(*) from pcm.relatorios_cliente_publicados), 1::bigint, 'síndico A vê o relatório do próprio condomínio');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000d137","user_role":"cliente-sindico","cliente_id":"00000000-0000-0000-0000-00000000c136","user_modulos":{}}';
select is((select count(*) from pcm.relatorios_cliente_publicados), 0::bigint, 'síndico B não vê o relatório do condomínio A');

reset role;
select * from finish();
rollback;
