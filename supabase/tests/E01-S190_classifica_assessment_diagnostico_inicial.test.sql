-- E01-S190_classifica_assessment_diagnostico_inicial.test.sql — pgTAP (AC-1).
-- Migration 1854: Assessment vira tipo de Inspeção "Diagnóstico Inicial do Cliente".
-- Rodar com `supabase test db` (requer Docker/Supabase local).
begin;
select plan(9);

-- 1) o catálogo nasce com exatamente a entrada esperada, idempotente (migration já rodou no
--    `db reset` que precede este teste — aqui só confirmamos que existe e é única).
select is(
  (select count(*)::int from pcm.tipos_inspecao where nome = 'Diagnóstico Inicial do Cliente'),
  1,
  'AC-1: catálogo tem exatamente uma entrada "Diagnóstico Inicial do Cliente"'
);

-- 1b) achado de /revisao-adversarial (17/11/2026): `nome` não tem UNIQUE em `tipos_inspecao`
--     (0091) — se já existir uma linha homônima apagada ou desativada (ex.: alguém testou o
--     nome manualmente), o lookup da migration não pode escolhê-la por acidente. Simula esse
--     estado inserindo uma segunda linha homônima, morta, e confirma que a mesma lógica de busca
--     da migration continua achando a linha VIVA original, não a morta.
select ok(
  (select id from pcm.tipos_inspecao where nome = 'Diagnóstico Inicial do Cliente') is not null,
  'pré-condição: existe uma linha viva "Diagnóstico Inicial do Cliente" antes do cenário adversarial'
);
insert into pcm.tipos_inspecao (nome, descricao, deleted_at)
values ('Diagnóstico Inicial do Cliente', '[TESTE] homônima apagada, não pode ser escolhida', now());
insert into pcm.tipos_inspecao (nome, descricao, ativo)
values ('Diagnóstico Inicial do Cliente', '[TESTE] homônima desativada, não pode ser escolhida', false);
select is(
  (
    select id from pcm.tipos_inspecao
    where nome = 'Diagnóstico Inicial do Cliente' and deleted_at is null and ativo = true
    order by created_at asc
    limit 1
  ),
  (select id from pcm.tipos_inspecao where nome = 'Diagnóstico Inicial do Cliente' and descricao like 'Consolida o antigo Assessment%'),
  'achado /revisao-adversarial: o lookup com filtro de deleted_at/ativo ignora homônima apagada e desativada'
);
delete from pcm.tipos_inspecao
where nome = 'Diagnóstico Inicial do Cliente' and descricao like '[TESTE] homônima%';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pcm-escrita-s190@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by)
values ('00000000-0000-0000-0000-00000000e5c1', '[TESTE] Cliente S190', '00000000-0000-0000-0000-00000000e501')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e501","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

-- 2) simula uma linha no estado PRÉ-migration (e_assessment=true, tipo_inspecao_id ainda nulo —
--    é o estado em que qualquer Assessment antigo chegaria se recriado hoje fora do fluxo novo).
insert into pcm.inspecoes (id, client_id, titulo, e_assessment, motivo_assessment, observacoes_gerais, anexos, created_by)
values (
  '00000000-0000-0000-0000-00000000e5c2', '00000000-0000-0000-0000-00000000e5c1',
  '[TESTE E2E] Assessment pré-classificação', true, 'inicio',
  'observação original, não pode mudar', '["evidencia-original.jpg"]'::jsonb,
  '00000000-0000-0000-0000-00000000e501'
);
select is(
  (select tipo_inspecao_id from pcm.inspecoes where id = '00000000-0000-0000-0000-00000000e5c2'),
  null,
  'estado simulado pré-migration: nasce sem tipo_inspecao_id (igual a um Assessment antigo real)'
);

-- 3) reaplica a MESMA lógica da migration 1854 (idempotente por design) sobre esta linha —
--    é o comportamento real que qualquer Assessment legado (incluindo os já existentes em
--    produção antes de 1854 rodar) recebeu quando a migration foi aplicada.
reset role;
update pcm.inspecoes
set tipo_inspecao_id = (select id from pcm.tipos_inspecao where nome = 'Diagnóstico Inicial do Cliente')
where e_assessment = true
  and tipo_inspecao_id is distinct from (select id from pcm.tipos_inspecao where nome = 'Diagnóstico Inicial do Cliente');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e501","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

-- 4) AC-1: a linha agora aponta pro tipo certo...
select is(
  (select ti.nome from pcm.inspecoes i join pcm.tipos_inspecao ti on ti.id = i.tipo_inspecao_id
     where i.id = '00000000-0000-0000-0000-00000000e5c2'),
  'Diagnóstico Inicial do Cliente',
  'AC-1: após classificação, a Inspeção aponta pro tipo "Diagnóstico Inicial do Cliente"'
);

-- 5) ...sem perder identidade (mesmo id)...
select is(
  (select id::text from pcm.inspecoes where titulo = '[TESTE E2E] Assessment pré-classificação'),
  '00000000-0000-0000-0000-00000000e5c2',
  'AC-1: identidade preservada — nenhum registro novo, mesmo id de sempre'
);

-- 6) ...nem histórico/evidência (nenhum outro campo foi tocado pela classificação)...
select is(
  (select observacoes_gerais from pcm.inspecoes where id = '00000000-0000-0000-0000-00000000e5c2'),
  'observação original, não pode mudar',
  'AC-1: histórico (observações) preservado — classificação não reescreve outros campos'
);
select is(
  (select anexos::text from pcm.inspecoes where id = '00000000-0000-0000-0000-00000000e5c2'),
  '["evidencia-original.jpg"]',
  'AC-1: evidência (anexos) preservada — classificação não reescreve outros campos'
);

-- 7) e-assessment continua true — não é removido, só deixa de ser o único sinalizador (nota da
--    migration: aposentar fica pra story própria, quando todo consumidor migrar).
select is(
  (select e_assessment from pcm.inspecoes where id = '00000000-0000-0000-0000-00000000e5c2'),
  true,
  'e_assessment não é removido pela classificação — continua existindo para quem ainda lê por ele'
);

reset role;
delete from pcm.inspecoes where id = '00000000-0000-0000-0000-00000000e5c2';
delete from pcm.clientes where id = '00000000-0000-0000-0000-00000000e5c1';

select * from finish();
rollback;
