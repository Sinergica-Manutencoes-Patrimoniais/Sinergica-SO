-- atendimento_historico_chamado_snapshots_rls.test.sql — pgTAP (E01-S89)
-- Snapshot imutável de conversa anexado a um Chamado (pcm.chamados) — leitura por atendimento OU
-- pcm, escrita só por atendimento:escrita, sem policy de update/delete pra authenticated.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atendimento-escrita-s89@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-leitura-s89@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sem-modulo-s89@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values ('00000000-0000-0000-0000-000000000cc1', '[TESTE] Cliente S89', '00000000-0000-0000-0000-000000000c01')
on conflict (id) do nothing;

insert into pcm.chamados (id, numero, cliente_id, titulo, created_by)
values ('00000000-0000-0000-0000-000000000cc2', 'CH-9001', '00000000-0000-0000-0000-000000000cc1', '[TESTE E2E] Chamado S89', '00000000-0000-0000-0000-000000000c01')
on conflict (id) do nothing;

insert into atendimento.conversas (id, client_id, instance_id, remote_jid, contato_nome, created_by)
values ('00000000-0000-0000-0000-000000000cc3', '00000000-0000-0000-0000-000000000cc1', 'inst-teste', '5511999990000@s.whatsapp.net', '[TESTE] Contato S89', '00000000-0000-0000-0000-000000000c01')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c01","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';

-- 1) AC-3: atendimento:escrita consegue anexar um snapshot
insert into atendimento.historico_chamado_snapshots
  (id, conversa_id, chamado_id, janela_dias, data_inicio, data_fim, mensagens, total_mensagens, created_by)
values (
  '00000000-0000-0000-0000-000000000cc4',
  '00000000-0000-0000-0000-000000000cc3',
  '00000000-0000-0000-0000-000000000cc2',
  7,
  now() - interval '7 days',
  now(),
  '[{"id":"m1","remetenteTipo":"cliente","conteudo":"Oi","tipoConteudo":"texto","midiaUrl":null,"createdAt":"2026-07-20T10:00:00Z"}]'::jsonb,
  1,
  '00000000-0000-0000-0000-000000000c01'
);
select is(
  (select total_mensagens from atendimento.historico_chamado_snapshots where id = '00000000-0000-0000-0000-000000000cc4'),
  1,
  'AC-3: atendimento:escrita cria o snapshot com total_mensagens'
);

-- 2) AC-3: leitura — quem tem atendimento:leitura/escrita enxerga o snapshot
select is(
  (select count(*) from atendimento.historico_chamado_snapshots where id = '00000000-0000-0000-0000-000000000cc4'),
  1::bigint,
  'quem tem atendimento:escrita enxerga o proprio snapshot'
);

-- 3) anexar de novo (mesmo Chamado, mesma conversa) cria outro registro — nunca sobrescreve
insert into atendimento.historico_chamado_snapshots
  (id, conversa_id, chamado_id, janela_dias, data_inicio, data_fim, mensagens, total_mensagens, created_by)
values (
  '00000000-0000-0000-0000-000000000cc5',
  '00000000-0000-0000-0000-000000000cc3',
  '00000000-0000-0000-0000-000000000cc2',
  3,
  now() - interval '3 days',
  now(),
  '[{"id":"m2","remetenteTipo":"ze","conteudo":"Olá!","tipoConteudo":"texto","midiaUrl":null,"createdAt":"2026-07-20T11:00:00Z"}]'::jsonb,
  1,
  '00000000-0000-0000-0000-000000000c01'
);
select is(
  (select count(*) from atendimento.historico_chamado_snapshots where chamado_id = '00000000-0000-0000-0000-000000000cc2'),
  2::bigint,
  'anexar de novo cria outro registro (nunca sobrescreve o anterior)'
);

-- 4) AC-3: append-only — sem policy de update pra authenticated
select throws_ok(
  $$ update atendimento.historico_chamado_snapshots set total_mensagens = 99 where id = '00000000-0000-0000-0000-000000000cc4' $$,
  '42501',
  null,
  'AC-3: ninguem atualiza snapshot (sem policy de update pra authenticated)'
);

-- 5) AC-3: append-only — sem policy de delete pra authenticated
select throws_ok(
  $$ delete from atendimento.historico_chamado_snapshots where id = '00000000-0000-0000-0000-000000000cc4' $$,
  '42501',
  null,
  'AC-3: ninguem apaga snapshot (sem policy de delete pra authenticated)'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c02","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';

-- 6) leitura cross-domínio: quem só tem pcm:leitura também enxerga o snapshot (aparece no detalhe do Chamado)
select is(
  (select count(*) from atendimento.historico_chamado_snapshots where chamado_id = '00000000-0000-0000-0000-000000000cc2'),
  2::bigint,
  'quem tem pcm:leitura enxerga o snapshot pelo lado do Chamado (leitura cross-dominio)'
);

-- 7) escrita: quem só tem pcm:leitura NAO consegue inserir snapshot (insert exige atendimento:escrita)
select throws_ok(
  $$ insert into atendimento.historico_chamado_snapshots
       (conversa_id, chamado_id, janela_dias, data_inicio, data_fim, mensagens, total_mensagens, created_by)
     values (
       '00000000-0000-0000-0000-000000000cc3',
       '00000000-0000-0000-0000-000000000cc2',
       1,
       now() - interval '1 day',
       now(),
       '[]'::jsonb,
       0,
       '00000000-0000-0000-0000-000000000c02'
     ) $$,
  '42501',
  null,
  'pcm:leitura sem atendimento:escrita NAO cria snapshot (RLS insert)'
);

reset role;
delete from atendimento.historico_chamado_snapshots where chamado_id = '00000000-0000-0000-0000-000000000cc2';
delete from atendimento.conversas where id = '00000000-0000-0000-0000-000000000cc3';
delete from pcm.chamados where id = '00000000-0000-0000-0000-000000000cc2';
delete from pcm.clientes where id = '00000000-0000-0000-0000-000000000cc1';

select * from finish();
rollback;
