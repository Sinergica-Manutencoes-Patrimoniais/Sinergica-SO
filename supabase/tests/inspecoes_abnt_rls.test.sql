-- inspecoes_abnt_rls.test.sql — pgTAP (E01-S73, AC-1 a AC-5)
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'insp-colab-s73@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'insp-supervisor-s73@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- Fixture base: colaborador com pcm:escrita cria cliente + inspeção + item.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000701","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

insert into pcm.clientes (id, nome, created_by)
values ('70000000-0000-0000-0000-000000000001', 'Cliente S73', '00000000-0000-0000-0000-000000000701');

insert into pcm.inspecoes (id, client_id, titulo, created_by)
values ('70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'Inspeção Predial S73', '00000000-0000-0000-0000-000000000701');

-- AC-2: código gerado automaticamente (trigger BEFORE INSERT), sem precisar setar DEFAULT volátil.
select isnt(
  (select codigo from pcm.inspecoes where id = '70000000-0000-0000-0000-000000000002'),
  null,
  'trigger gera codigo INSP-NNNN automaticamente ao inserir'
);
select ok(
  (select codigo like 'INSP-%' from pcm.inspecoes where id = '70000000-0000-0000-0000-000000000002'),
  'codigo gerado segue o formato INSP-NNNN'
);

insert into pcm.inspecao_itens (id, inspecao_id, client_id, sistema, descricao, resultado, created_by)
values ('70000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'geral', 'Item S73', 'nao_avaliado', '00000000-0000-0000-0000-000000000701');

-- AC-3: resultado "não aplicável" (ampliação do CHECK — antes só conforme/nao_conforme/atencao/nao_avaliado).
select lives_ok(
  $$ update pcm.inspecao_itens set resultado = 'nao_aplicavel' where id = '70000000-0000-0000-0000-000000000003' $$,
  'item aceita resultado nao_aplicavel (CHECK ampliado pela NBR 16747)'
);

-- AC-3: grau de risco fora do enum é rejeitado.
select throws_ok(
  $$ update pcm.inspecao_itens set grau_risco = 'inexistente' where id = '70000000-0000-0000-0000-000000000003' $$,
  '23514',
  null,
  'grau_risco fora do enum baixo/medio/alto/critico eh rejeitado'
);

-- AC-1: excluir item — grant+policy DELETE não existiam antes desta story (achado ao implementar).
select lives_ok(
  $$ delete from pcm.inspecao_itens where id = '70000000-0000-0000-0000-000000000003' $$,
  'pcm escrita exclui item de inspecao (policy DELETE nova desta story)'
);

-- Leitura pura não pode excluir item nem escrever em tipos_inspecao.
insert into pcm.inspecao_itens (id, inspecao_id, client_id, sistema, descricao, resultado, created_by)
values ('70000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'geral', 'Item S73-b', 'conforme', '00000000-0000-0000-0000-000000000701');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000701","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
delete from pcm.inspecao_itens where id = '70000000-0000-0000-0000-000000000004';
select is(
  (select count(*) from pcm.inspecao_itens where id = '70000000-0000-0000-0000-000000000004'),
  1::bigint,
  'pcm leitura NAO exclui item de inspecao (RLS filtra zero linhas)'
);

-- D-4: parametrização (tipos_inspecao/templates) exige supervisor/superadmin — colaborador com
-- pcm:escrita (mas papel comum) não passa, mesmo tendo escrita normal no módulo.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000701","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select throws_ok(
  $$ insert into pcm.tipos_inspecao (nome, created_by) values ('Tipo negado', '00000000-0000-0000-0000-000000000701') $$,
  '42501',
  null,
  'colaborador com pcm:escrita mas sem papel supervisor/superadmin NAO cria tipo de inspecao'
);

-- Supervisor com pcm:escrita cria tipo de inspeção e template.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000702","user_role":"supervisor","user_modulos":{"pcm":"escrita"}}';
select lives_ok(
  $$ insert into pcm.tipos_inspecao (id, nome, norma_tecnica, created_by) values ('70000000-0000-0000-0000-000000000005', 'Predial', 'ABNT NBR 16747', '00000000-0000-0000-0000-000000000702') $$,
  'supervisor com pcm:escrita cria tipo de inspecao'
);
select lives_ok(
  $$ insert into pcm.checklist_templates (id, tipo_inspecao_id, nome, created_by) values ('70000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000005', 'Checklist padrão', '00000000-0000-0000-0000-000000000702') $$,
  'supervisor com pcm:escrita cria checklist template'
);
select lives_ok(
  $$ insert into pcm.checklist_template_itens (template_id, categoria, sistema, elemento, obrigatorio, created_by) values ('70000000-0000-0000-0000-000000000006', 'Estrutural', 'estrutural', 'Viga', true, '00000000-0000-0000-0000-000000000702') $$,
  'supervisor com pcm:escrita cria item de checklist template'
);

-- Storage: bucket privado inspecoes-midia gated por pcm:leitura no select, pcm:escrita no insert.
reset role;
select is(
  (select public from storage.buckets where id = 'inspecoes-midia'),
  false,
  'bucket inspecoes-midia eh privado'
);

select * from finish();
rollback;
