-- pcm_identificador_ativo.test.sql — pgTAP (E01-S157 AC-1 e AC-5)
-- Roda no job db-tests; esta máquina não tem Docker/Supabase local.

begin;
select plan(16);

select has_column('pcm', 'clientes', 'sigla', 'AC-1: Cliente tem sigla');
select has_column('pcm', 'areas', 'sigla', 'AC-1: Área tem sigla');
select has_column('pcm', 'locais', 'sigla', 'AC-1: Local tem sigla');

set local role service_role;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000257',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'identificador-s157@test.local',
  crypt('x', gen_salt('bf')),
  now(), '{}', '{}', now(), now()
)
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, sigla, created_by, updated_by)
values (
  '00000000-0000-0000-0000-000000000258',
  '[TESTE] Cliente S157', 'T57',
  '00000000-0000-0000-0000-000000000257',
  '00000000-0000-0000-0000-000000000257'
);
select lives_ok(
  $$ update pcm.clientes set sigla = 'TOA' where id = '00000000-0000-0000-0000-000000000258' $$,
  'AC-1: aceita sigla de três caracteres maiúsculos'
);
select throws_ok(
  $$ update pcm.clientes set sigla = 'TO' where id = '00000000-0000-0000-0000-000000000258' $$,
  '23514', null,
  'AC-1: rejeita sigla curta'
);
select throws_ok(
  $$ update pcm.clientes set sigla = 'to1' where id = '00000000-0000-0000-0000-000000000258' $$,
  '23514', null,
  'AC-1: rejeita sigla minúscula'
);
select throws_ok(
  $$ update pcm.clientes set sigla = 'TOAA' where id = '00000000-0000-0000-0000-000000000258' $$,
  '23514', null,
  'AC-1: rejeita sigla longa'
);

insert into pcm.areas (id, cliente_id, nome, sigla, created_by, updated_by)
values (
  '00000000-0000-0000-0000-000000000259',
  '00000000-0000-0000-0000-000000000258',
  '[TESTE] Área S157', 'A01',
  '00000000-0000-0000-0000-000000000257',
  '00000000-0000-0000-0000-000000000257'
);
select throws_ok(
  $$ insert into pcm.areas (id, cliente_id, nome, sigla) values ('00000000-0000-0000-0000-000000000260', '00000000-0000-0000-0000-000000000258', '[TESTE] Área duplicada S157', 'A01') $$,
  '23505', null,
  'AC-1: mesma sigla de Área no Cliente é rejeitada'
);
insert into pcm.clientes (id, nome, sigla, created_by, updated_by)
values (
  '00000000-0000-0000-0000-000000000261',
  '[TESTE] Outro Cliente S157', 'U57',
  '00000000-0000-0000-0000-000000000257',
  '00000000-0000-0000-0000-000000000257'
);
select lives_ok(
  $$ insert into pcm.areas (id, cliente_id, nome, sigla) values ('00000000-0000-0000-0000-000000000262', '00000000-0000-0000-0000-000000000261', '[TESTE] Área outro Cliente S157', 'A01') $$,
  'AC-1: mesma sigla de Área em outro Cliente é aceita'
);

insert into pcm.locais (id, area_id, nome, sigla, created_by, updated_by)
values (
  '00000000-0000-0000-0000-000000000263',
  '00000000-0000-0000-0000-000000000259',
  '[TESTE] Local raiz S157', 'L01',
  '00000000-0000-0000-0000-000000000257',
  '00000000-0000-0000-0000-000000000257'
);
select throws_ok(
  $$ insert into pcm.locais (id, area_id, nome, sigla) values ('00000000-0000-0000-0000-000000000264', '00000000-0000-0000-0000-000000000259', '[TESTE] Local raiz duplicado S157', 'L01') $$,
  '23505', null,
  'AC-1: mesma sigla de Local no mesmo pai é rejeitada'
);
select lives_ok(
  $$ insert into pcm.locais (id, area_id, parent_id, nome, sigla) values ('00000000-0000-0000-0000-000000000265', '00000000-0000-0000-0000-000000000259', '00000000-0000-0000-0000-000000000263', '[TESTE] Local filho S157', 'L01') $$,
  'AC-1: mesma sigla de Local em outro pai é aceita'
);

select is(
  pcm.fn_proximo_sequencial_identificador('T57-A01-ELE-QDC'),
  '01',
  'AC-5: prefixo sem ativo devolve 01'
);
insert into pcm.equipamentos (id, nome, identificador, created_by, updated_by)
values
  ('00000000-0000-0000-0000-000000000266', '[TESTE] Componente 01 S157', 'T57-A01-ELE-QDC-01', '00000000-0000-0000-0000-000000000257', '00000000-0000-0000-0000-000000000257'),
  ('00000000-0000-0000-0000-000000000267', '[TESTE] Componente 03 S157', 'T57-A01-ELE-QDC-03', '00000000-0000-0000-0000-000000000257', '00000000-0000-0000-0000-000000000257');
insert into pcm.sistemas (id, cliente_id, nome, codigo, created_by, updated_by)
values (
  '00000000-0000-0000-0000-000000000268',
  '00000000-0000-0000-0000-000000000258',
  '[TESTE] Sistema 05 S157', 'T57-A01-ELE-QDC-05',
  '00000000-0000-0000-0000-000000000257',
  '00000000-0000-0000-0000-000000000257'
);
select is(
  pcm.fn_proximo_sequencial_identificador('T57-A01-ELE-QDC'),
  '06',
  'AC-5: maior sufixo entre Componente e Sistema define o próximo'
);
select throws_ok(
  $$ select pcm.fn_proximo_sequencial_identificador('sigla-invalida') $$,
  '22023', 'prefixo_invalido',
  'AC-5: prefixo inválido falha com código estável'
);
select throws_ok(
  $$ insert into pcm.equipamentos (id, nome, identificador) values ('00000000-0000-0000-0000-000000000269', '[TESTE] Duplicata padrão S157', 'T57-A01-ELE-QDC-01') $$,
  '23505', null,
  'AC-5: índice padrão rejeita identificador duplicado'
);
select lives_ok(
  $$ insert into pcm.equipamentos (id, nome, identificador) values ('00000000-0000-0000-0000-000000000270', '[TESTE] Legado 1 S157', '123'), ('00000000-0000-0000-0000-000000000271', '[TESTE] Legado 2 S157', '123') $$,
  'AC-5: índice padrão permite identificador legado duplicado'
);

reset role;
select * from finish();
rollback;
