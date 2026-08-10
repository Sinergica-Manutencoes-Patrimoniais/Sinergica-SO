-- comercial_fundacao_rls.test.sql — pgTAP (E03-S01, AC-1/AC-3/AC-6)
-- RLS FORCE do schema `comercial` gateada por user_modulos.comercial, append-only de
-- oportunidade_eventos, trigger de motivo de perda obrigatório e a view relacionamento.contas
-- herdando a RLS de pcm.clientes (security_invoker).
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'com-sem-modulo-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'com-leitura-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'com-escrita-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'com-superadmin-s01@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

-- Conta de apoio (o Comercial não cria Conta; ela é do PCM).
insert into pcm.clientes (id, nome, ativo)
values ('00000000-0000-0000-0000-0000000003c1', 'Condomínio Teste E03-S01', true)
on conflict (id) do nothing;

set local role authenticated;

-- 1) sem `comercial` em user_modulos: RLS FORCE nega, sem erro
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000301","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from comercial.etapas_funil),
  0,
  'sem modulo comercial: select de etapas_funil retorna zero linhas'
);
select is(
  (select count(*)::int from comercial.oportunidades),
  0,
  'sem modulo comercial: select de oportunidades retorna zero linhas'
);

-- 2) leitura: enxerga o seed das 6 etapas, mas não escreve
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000302","user_role":"colaborador","user_modulos":{"comercial":"leitura"}}';
select ok(
  (select count(*)::int from comercial.etapas_funil) >= 6,
  'leitura comercial: select enxerga o seed das etapas do funil'
);
select ok(
  (select count(*)::int from comercial.motivos_perda) >= 4,
  'leitura comercial: select enxerga o seed dos motivos de perda'
);
select throws_ok(
  $$ insert into comercial.motivos_perda (nome) values ('Motivo negado') $$,
  '42501',
  null,
  'leitura comercial NAO insere motivo de perda'
);
select throws_ok(
  $$ insert into comercial.oportunidades (cliente_id, etapa_id, titulo)
     select '00000000-0000-0000-0000-0000000003c1', id, 'Negada'
       from comercial.etapas_funil where tipo = 'aberta' limit 1 $$,
  '42501',
  null,
  'leitura comercial NAO insere oportunidade'
);

-- 3) escrita: cria oportunidade na etapa aberta
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000303","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
insert into comercial.oportunidades (id, cliente_id, etapa_id, titulo)
select
  '00000000-0000-0000-0000-0000000003a1',
  '00000000-0000-0000-0000-0000000003c1',
  id,
  'Oportunidade de teste'
from comercial.etapas_funil
where tipo = 'aberta' and ativo
order by ordem
limit 1;

select is(
  (select count(*)::int from comercial.oportunidades where id = '00000000-0000-0000-0000-0000000003a1'),
  1,
  'escrita comercial: cria oportunidade'
);

-- AC-6: oportunidade em etapa aberta não guarda fechamento
select is(
  (select fechada_em from comercial.oportunidades where id = '00000000-0000-0000-0000-0000000003a1'),
  null,
  'oportunidade em etapa aberta nao tem fechada_em'
);

-- 4) AC-6 — o coração desta story: perda SEM motivo é recusada pelo BANCO, não só pela UI.
-- Se isto passar a permitir, o win/loss do dashboard (E03-S08) vira estimativa.
select throws_ok(
  $$ update comercial.oportunidades
        set etapa_id = (select id from comercial.etapas_funil where tipo = 'perdida' limit 1)
      where id = '00000000-0000-0000-0000-0000000003a1' $$,
  'P0001',
  null,
  'mover para etapa perdida SEM motivo e recusado pelo trigger'
);

-- 5) com motivo, a perda passa e o fechamento é preenchido sozinho
update comercial.oportunidades
   set etapa_id = (select id from comercial.etapas_funil where tipo = 'perdida' limit 1),
       motivo_perda_id = (select id from comercial.motivos_perda where ativo limit 1)
 where id = '00000000-0000-0000-0000-0000000003a1';

select isnt(
  (select fechada_em from comercial.oportunidades where id = '00000000-0000-0000-0000-0000000003a1'),
  null,
  'perda COM motivo grava fechada_em automaticamente'
);

-- 6) reabrir limpa fechamento e motivo (senão o dashboard segue contando como perdida)
update comercial.oportunidades
   set etapa_id = (select id from comercial.etapas_funil where tipo = 'aberta' and ativo order by ordem limit 1)
 where id = '00000000-0000-0000-0000-0000000003a1';

select is(
  (select fechada_em from comercial.oportunidades where id = '00000000-0000-0000-0000-0000000003a1'),
  null,
  'reabrir oportunidade limpa fechada_em'
);
select is(
  (select motivo_perda_id from comercial.oportunidades where id = '00000000-0000-0000-0000-0000000003a1'),
  null,
  'reabrir oportunidade limpa motivo_perda_id'
);

-- 7) oportunidade_eventos é append-only — nem UPDATE nem DELETE, para ninguém
insert into comercial.oportunidade_eventos (oportunidade_id, etapa_de, etapa_para)
select '00000000-0000-0000-0000-0000000003a1', null, id
from comercial.etapas_funil where tipo = 'aberta' and ativo order by ordem limit 1;

select throws_ok(
  $$ update comercial.oportunidade_eventos set ocorrido_em = now() $$,
  '42501',
  null,
  'oportunidade_eventos NAO aceita update (append-only)'
);

-- superadmin também não reescreve histórico de funil
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000304","user_role":"superadmin","user_modulos":{}}';
select throws_ok(
  $$ delete from comercial.oportunidade_eventos $$,
  '42501',
  null,
  'superadmin NAO apaga oportunidade_eventos (append-only)'
);

-- 8) AC-3 — a view herda a RLS de pcm.clientes (security_invoker). Sem os módulos, zero linhas.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000301","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*)::int from relacionamento.contas),
  0,
  'sem modulo pcm: view relacionamento.contas retorna zero linhas (security_invoker)'
);

select * from finish();
rollback;
