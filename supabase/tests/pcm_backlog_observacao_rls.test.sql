-- pcm_backlog_observacao_rls.test.sql — pgTAP (E01-S83 AC-1/AC-2/AC-3/AC-4)
-- `observacao` (texto livre) e `origem_inspecao_item_id` (rastreio, populado só a partir de
-- E01-S90) são colunas aditivas em `pcm.ordens_servico` — a RLS de leitura/escrita da tabela já
-- existe (E01-S01 e seguintes); este teste só prova que as colunas novas se comportam corretamente
-- dentro dela e que o INSERT de uma OS "backlog" (status='solicitacao', sem data/técnico) nunca
-- ganha `auvo_task_id` sozinho (AC-2 — a criação nunca dispara sync com o Auvo).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-escrita-s83@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values ('00000000-0000-0000-0000-0000000008c1', '[TESTE] Cliente S83', '00000000-0000-0000-0000-000000000801')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000801","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

-- 1) cadastro direto de backlog (AC-1): sem data, sem técnico, com observação — persiste
insert into pcm.ordens_servico (
  id, client_id, numero, titulo, categoria, status, prioridade,
  gravidade, urgencia, tendencia, observacao, origem, created_by
) values (
  '00000000-0000-0000-0000-0000000008c2', '00000000-0000-0000-0000-0000000008c1', '[TESTE] BL-001',
  '[TESTE E2E] Item de backlog direto', 'corretiva', 'solicitacao', 'media',
  3, 3, 3, 'Aguardando autorização do síndico', 'manual', '00000000-0000-0000-0000-000000000801'
);
select is(
  (select observacao from pcm.ordens_servico where id = '00000000-0000-0000-0000-0000000008c2'),
  'Aguardando autorização do síndico',
  'AC-4: observacao (texto livre) persiste no INSERT'
);

-- 2) AC-2: item recém-criado não tem vínculo Auvo — INSERT nunca dispara o trigger de sync
--    (só a transição de status pra 'planejamento' via UPDATE dispara, ver 0011_E01-S09).
select is(
  (select auvo_task_id from pcm.ordens_servico where id = '00000000-0000-0000-0000-0000000008c2'),
  null,
  'AC-2: item de backlog nasce sem auvo_task_id (criação nunca sincroniza)'
);
select is(
  (select data_agendada from pcm.ordens_servico where id = '00000000-0000-0000-0000-0000000008c2'),
  null,
  'AC-2: item de backlog nasce sem data_agendada'
);

-- 3) AC-3: origem_inspecao_item_id aceita null (cadastro direto) e referência válida
update pcm.ordens_servico set origem_inspecao_item_id = null
  where id = '00000000-0000-0000-0000-0000000008c2';
select is(
  (select origem_inspecao_item_id from pcm.ordens_servico where id = '00000000-0000-0000-0000-0000000008c2'),
  null,
  'AC-3: origem_inspecao_item_id nulo no cadastro direto (sem inspeção de origem)'
);

-- 4) FK rejeita item de inspeção inexistente (defesa em profundidade — banco, não só UI)
select throws_ok(
  $$ update pcm.ordens_servico set origem_inspecao_item_id = '00000000-0000-0000-0000-00000000dead' where id = '00000000-0000-0000-0000-0000000008c2' $$,
  '23503',
  null,
  'FK ordens_servico_origem_inspecao_item_id_fkey rejeita item de inspeção inexistente'
);

reset role;
delete from pcm.ordens_servico where id = '00000000-0000-0000-0000-0000000008c2';
delete from pcm.clientes where id = '00000000-0000-0000-0000-0000000008c1';

select * from finish();
rollback;
