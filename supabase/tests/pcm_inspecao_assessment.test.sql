-- pcm_inspecao_assessment.test.sql — pgTAP (E01-S90 AC-1/AC-2/AC-3)
-- Assessment estende `pcm.inspecoes`/`pcm.inspecao_itens` (design.md D1): motivo_assessment,
-- destino/destino_responsavel do item, idempotência de `auvo_questao_chave` e o vínculo
-- `pcm.chamados.origem_inspecao_item_id`.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-escrita-s90@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values ('00000000-0000-0000-0000-000000000dc1', '[TESTE] Cliente S90', '00000000-0000-0000-0000-000000000d01')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000d01","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

-- 1) AC-1: cria uma inspeção-assessment (e_assessment=true, motivo válido)
insert into pcm.inspecoes (id, client_id, titulo, e_assessment, motivo_assessment, created_by)
values ('00000000-0000-0000-0000-000000000dc2', '00000000-0000-0000-0000-000000000dc1', '[TESTE E2E] Assessment S90', true, 'inicio', '00000000-0000-0000-0000-000000000d01');
select is(
  (select motivo_assessment from pcm.inspecoes where id = '00000000-0000-0000-0000-000000000dc2'),
  'inicio',
  'AC-1: assessment nasce com motivo_assessment válido'
);

-- 2) motivo_assessment rejeita valor fora do enum
select throws_ok(
  $$ insert into pcm.inspecoes (client_id, titulo, e_assessment, motivo_assessment, created_by)
     values ('00000000-0000-0000-0000-000000000dc1', 'x', true, 'motivo_invalido', '00000000-0000-0000-0000-000000000d01') $$,
  '23514',
  null,
  'motivo_assessment rejeita valor fora do enum'
);

-- 3) AC-2/D2: item com auvo_questao_chave (simula 1 resposta do questionário)
insert into pcm.inspecao_itens (id, inspecao_id, client_id, sistema, descricao, auvo_questao_chave, created_by)
values ('00000000-0000-0000-0000-000000000dc3', '00000000-0000-0000-0000-000000000dc2', '00000000-0000-0000-0000-000000000dc1', 'geral', 'Hidrante funcional?: Não', 'q1', '00000000-0000-0000-0000-000000000d01');
select is(
  (select auvo_questao_chave from pcm.inspecao_itens where id = '00000000-0000-0000-0000-000000000dc3'),
  'q1',
  'AC-2: item guarda a chave de idempotência do questionário'
);

-- 4) D2: reprocessar a mesma questão (mesma inspeção + mesma chave) é rejeitado pelo índice único
select throws_ok(
  $$ insert into pcm.inspecao_itens (inspecao_id, client_id, sistema, descricao, auvo_questao_chave, created_by)
     values ('00000000-0000-0000-0000-000000000dc2', '00000000-0000-0000-0000-000000000dc1', 'geral', 'duplicado', 'q1', '00000000-0000-0000-0000-000000000d01') $$,
  '23505',
  null,
  'D2: mesma inspeção+questão não duplica item (índice único parcial)'
);

-- 5) AC-3: item deriva Chamado — destino/destino_responsavel válidos
update pcm.inspecao_itens set destino = 'chamado', destino_responsavel = 'sinergica'
  where id = '00000000-0000-0000-0000-000000000dc3';
select is(
  (select destino from pcm.inspecao_itens where id = '00000000-0000-0000-0000-000000000dc3'),
  'chamado',
  'AC-3: item marcado como derivado pra Chamado'
);

-- 6) destino rejeita valor fora do enum
select throws_ok(
  $$ update pcm.inspecao_itens set destino = 'email' where id = '00000000-0000-0000-0000-000000000dc3' $$,
  '23514',
  null,
  'destino rejeita valor fora do enum'
);

-- 7) AC-3: pcm.chamados.origem_inspecao_item_id aceita item existente (rastreio Chamado→item)
insert into pcm.chamados (id, numero, cliente_id, titulo, origem, origem_inspecao_item_id, created_by)
values ('00000000-0000-0000-0000-000000000dc4', 'CH-9002', '00000000-0000-0000-0000-000000000dc1', '[TESTE E2E] Chamado do assessment', 'inspecao', '00000000-0000-0000-0000-000000000dc3', '00000000-0000-0000-0000-000000000d01');
select is(
  (select origem_inspecao_item_id from pcm.chamados where id = '00000000-0000-0000-0000-000000000dc4'),
  '00000000-0000-0000-0000-000000000dc3'::uuid,
  'AC-3: Chamado grava o vinculo origem_inspecao_item_id'
);

-- 8) FK rejeita item de inspeção inexistente (defesa em profundidade)
select throws_ok(
  $$ update pcm.chamados set origem_inspecao_item_id = '00000000-0000-0000-0000-00000000dead' where id = '00000000-0000-0000-0000-000000000dc4' $$,
  '23503',
  null,
  'FK chamados_origem_inspecao_item_id_fkey rejeita item inexistente'
);

reset role;
delete from pcm.chamados where id = '00000000-0000-0000-0000-000000000dc4';
delete from pcm.inspecao_itens where inspecao_id = '00000000-0000-0000-0000-000000000dc2';
delete from pcm.inspecoes where id = '00000000-0000-0000-0000-000000000dc2';
delete from pcm.clientes where id = '00000000-0000-0000-0000-000000000dc1';

select * from finish();
rollback;
