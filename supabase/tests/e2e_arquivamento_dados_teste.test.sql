-- e2e_arquivamento_dados_teste.test.sql — pgTAP (E01-S205)
-- Prova que arquivar os "[TESTE E2E]" é seletivo, idempotente, reversível, não enfileira nada
-- para o Auvo real e que a allowlist/massa do caderno fica intacta.
-- Rodar com `supabase test db`.

begin;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000e2e01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2e-arq-s205@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- Cenário -----------------------------------------------------------------------------------
-- A: cliente de teste (alvo)  | B: cliente de teste na allowlist (massa do caderno)
-- C: cliente real sem prefixo (Escritório) | D: cliente de teste COM auvo_id (não pode entrar)
-- E: cliente de teste já apagado, com área viva (órfã)
insert into pcm.clientes (id, nome, auvo_id, created_by, deleted_at, ativo) values
  ('e2e00000-0000-0000-0000-00000000000a', '[TESTE E2E] Cliente A s205', null, '00000000-0000-0000-0000-0000000e2e01', null, true),
  ('e2e00000-0000-0000-0000-00000000000b', '[TESTE E2E] Cliente massa s205', null, '00000000-0000-0000-0000-0000000e2e01', null, true),
  ('e2e00000-0000-0000-0000-00000000000c', 'Sinérgica - Escritório s205', null, '00000000-0000-0000-0000-0000000e2e01', null, true),
  ('e2e00000-0000-0000-0000-00000000000d', '[TESTE E2E] Cliente auvo s205', 987650001, '00000000-0000-0000-0000-0000000e2e01', null, true),
  ('e2e00000-0000-0000-0000-00000000000e', '[TESTE E2E] Cliente orfao s205', null, '00000000-0000-0000-0000-0000000e2e01', now() - interval '1 day', false);

insert into pcm.areas (id, cliente_id, nome) values
  ('e2e00000-0000-0000-0000-0000000000a1', 'e2e00000-0000-0000-0000-00000000000a', 'Area A'),
  ('e2e00000-0000-0000-0000-0000000000b1', 'e2e00000-0000-0000-0000-00000000000b', 'Area B'),
  ('e2e00000-0000-0000-0000-0000000000c1', 'e2e00000-0000-0000-0000-00000000000c', 'Area C'),
  ('e2e00000-0000-0000-0000-0000000000e1', 'e2e00000-0000-0000-0000-00000000000e', 'Area E orfa');
insert into pcm.locais (id, area_id, nome) values
  ('e2e00000-0000-0000-0000-0000000001a1', 'e2e00000-0000-0000-0000-0000000000a1', 'Local A'),
  ('e2e00000-0000-0000-0000-0000000001c1', 'e2e00000-0000-0000-0000-0000000000c1', 'Local C');
insert into pcm.sistemas (id, cliente_id, nome) values
  ('e2e00000-0000-0000-0000-0000000002a1', 'e2e00000-0000-0000-0000-00000000000a', 'Sistema A'),
  ('e2e00000-0000-0000-0000-0000000002c1', 'e2e00000-0000-0000-0000-00000000000c', 'Sistema C');
insert into pcm.equipamentos (id, nome, client_id) values
  ('e2e00000-0000-0000-0000-0000000003a1', 'Equip A', 'e2e00000-0000-0000-0000-00000000000a'),
  ('e2e00000-0000-0000-0000-0000000003b1', 'Equip B', 'e2e00000-0000-0000-0000-00000000000b'),
  ('e2e00000-0000-0000-0000-0000000003c1', 'Equip C', 'e2e00000-0000-0000-0000-00000000000c'),
  ('e2e00000-0000-0000-0000-0000000003f1', '[TESTE E2E] Equip solto s205', null);
insert into pcm.ferramentas (id, nome) values
  ('e2e00000-0000-0000-0000-0000000004a1', '[TESTE E2E] Ferramenta s205'),
  ('e2e00000-0000-0000-0000-0000000004c1', 'Furadeira real s205');

-- allowlist por id (cliente B)
insert into pcm.e2e_allowlist (tabela, row_id, motivo)
values ('clientes', 'e2e00000-0000-0000-0000-00000000000b', 'teste s205');

-- Permissão ---------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2e01","user_role":"superadmin"}';
select throws_ok($$ select * from pcm.arquivar_dados_teste_e2e(true) $$, '42501', null,
  'authenticated (mesmo superadmin) NAO executa o arquivamento');
select throws_ok($$ select * from pcm.restaurar_dados_teste_e2e() $$, '42501', null,
  'authenticated NAO executa a restauracao');
select throws_ok($$ insert into pcm.e2e_allowlist (tabela, row_id, motivo) values ('clientes', gen_random_uuid(), 'x') $$,
  null, null, 'authenticated NAO escreve na allowlist');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000e2e01","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select is((select count(*)::int from pcm.e2e_arquivamento), 0, 'colaborador NAO le o log (RLS)');
reset role;

-- as inserts do cenario enfileiraram 'create' no outbox; zera para provar o arquivamento
delete from pcm.auvo_sync_outbox where row_id::text like 'e2e00000-%';

-- Dry-run -------------------------------------------------------------------------------------
set local role service_role;
select is((select count(*)::int from pcm.arquivar_dados_teste_e2e()), 8,
  'dry-run lista 8 linhas (cliente A, 2 areas, local, sistema, 2 equipamentos, ferramenta)');
select is((select count(*)::int from pcm.clientes where starts_with(nome, '[TESTE E2E] ') and nome like '%s205' and deleted_at is not null), 1,
  'dry-run NAO escreve (so o cliente E ja estava apagado)');

-- Execução --------------------------------------------------------------------------------------
create temporary table _r as select * from pcm.arquivar_dados_teste_e2e(true);
select is((select count(*)::int from _r), 8, 'execucao arquiva as mesmas 8 linhas');

select is((select count(*)::int from pcm.clientes where id = 'e2e00000-0000-0000-0000-00000000000a' and deleted_at is not null and ativo = false), 1,
  'cliente A arquivado (deleted_at + ativo=false)');
select is((select count(*)::int from pcm.areas where id in ('e2e00000-0000-0000-0000-0000000000a1','e2e00000-0000-0000-0000-0000000000e1') and deleted_at is not null), 2,
  'areas de A e a area orfa de E (cliente ja apagado) arquivadas');
select is((select count(*)::int from pcm.locais where id = 'e2e00000-0000-0000-0000-0000000001a1' and deleted_at is not null)
        + (select count(*)::int from pcm.sistemas where id = 'e2e00000-0000-0000-0000-0000000002a1' and deleted_at is not null)
        + (select count(*)::int from pcm.equipamentos where id in ('e2e00000-0000-0000-0000-0000000003a1','e2e00000-0000-0000-0000-0000000003f1') and deleted_at is not null)
        + (select count(*)::int from pcm.ferramentas where id = 'e2e00000-0000-0000-0000-0000000004a1' and deleted_at is not null),
  5, 'local, sistema, 2 equipamentos e ferramenta de teste arquivados');

select is((select count(*)::int from pcm.clientes where id = 'e2e00000-0000-0000-0000-00000000000b' and deleted_at is null and ativo), 1,
  'allowlist: cliente B (massa do caderno) INTACTO');
select is((select count(*)::int from pcm.areas where id = 'e2e00000-0000-0000-0000-0000000000b1' and deleted_at is null)
        + (select count(*)::int from pcm.equipamentos where id = 'e2e00000-0000-0000-0000-0000000003b1' and deleted_at is null), 2,
  'allowlist: filhos do cliente B INTACTOS');
select is((select count(*)::int from pcm.clientes where id = 'e2e00000-0000-0000-0000-00000000000c' and deleted_at is null)
        + (select count(*)::int from pcm.areas where id = 'e2e00000-0000-0000-0000-0000000000c1' and deleted_at is null)
        + (select count(*)::int from pcm.locais where id = 'e2e00000-0000-0000-0000-0000000001c1' and deleted_at is null)
        + (select count(*)::int from pcm.sistemas where id = 'e2e00000-0000-0000-0000-0000000002c1' and deleted_at is null)
        + (select count(*)::int from pcm.equipamentos where id = 'e2e00000-0000-0000-0000-0000000003c1' and deleted_at is null)
        + (select count(*)::int from pcm.ferramentas where id = 'e2e00000-0000-0000-0000-0000000004c1' and deleted_at is null),
  6, 'cliente real sem prefixo (Escritorio) e tudo dele INTACTOS');
select is((select count(*)::int from pcm.clientes where id = 'e2e00000-0000-0000-0000-00000000000d' and deleted_at is null), 1,
  'cliente de teste com auvo_id NAO e tocado');

select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in (select id from _r)), 0,
  'NADA enfileirado no outbox do Auvo (GUC anti-loop)');

-- Idempotência ----------------------------------------------------------------------------------
select is((select count(*)::int from pcm.arquivar_dados_teste_e2e(true)), 0, '2a execucao: 0 linhas');
select is((select count(*)::int from pcm.e2e_arquivamento), 8, 'log nao duplica na 2a execucao');

-- Reversão --------------------------------------------------------------------------------------
-- alguém apaga de novo OUTRO carimbo: nao pode ser ressuscitado pela restauracao
update pcm.ferramentas set deleted_at = now() + interval '1 hour' where id = 'e2e00000-0000-0000-0000-0000000004a1';
select is((select sum(restauradas)::int from pcm.restaurar_dados_teste_e2e()), 7,
  'restauracao devolve 7 (a ferramenta reapagada depois NAO ressuscita)');
select is((select count(*)::int from pcm.clientes where id = 'e2e00000-0000-0000-0000-00000000000a' and deleted_at is null and ativo), 1,
  'cliente A restaurado (deleted_at null, ativo true)');
select is((select count(*)::int from pcm.clientes where id = 'e2e00000-0000-0000-0000-00000000000e' and deleted_at is not null), 1,
  'cliente E (ja apagado antes) continua apagado: nunca foi arquivado');

select * from finish();
rollback;
