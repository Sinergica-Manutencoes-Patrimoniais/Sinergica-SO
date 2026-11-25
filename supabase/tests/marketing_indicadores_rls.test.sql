-- marketing_indicadores_rls.test.sql — pgTAP (E06-S01)
-- Prova, em pares permitido/negado, que o schema `marketing` da migration 1900 protege de fato:
-- leitura por módulo, escrita só com `escrita`, idempotência do grão anúncio-dia, unicidade do
-- vínculo com a oportunidade e a recusa da receita para quem não tem o Comercial.
--
-- As policies e as RPCs desta migration NÃO leem permissão do JWT: chamam
-- `config.sso_acesso_atual(modulo, nivel)` (E00-S27/ADR-1691), que relê `config.usuarios` +
-- `resolver_permissoes_modulo` a cada avaliação. Por isso a permissão de cada ator precisa
-- existir DE VERDADE no banco: o claim sozinho não concede nada, e é essa a propriedade testada.
--
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(20);

-- ─── fixture ────────────────────────────────────────────────────────────────
-- Quatro atores: leitura no marketing · escrita no marketing + leitura no comercial ·
-- nenhum acesso ao marketing · escrita no marketing SEM comercial (a prova do AC-17).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values
  ('06010000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mkt-leitura-s01@test.local',
   crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('06010000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mkt-escrita-s01@test.local',
   crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('06010000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mkt-sem-modulo-s01@test.local',
   crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
  ('06010000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mkt-sem-comercial-s01@test.local',
   crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into config.grupos (id, nome, ativo) values
  ('06010000-0000-4000-8000-0000000000a1', '[TESTE] S01 marketing leitura', true),
  ('06010000-0000-4000-8000-0000000000a2', '[TESTE] S01 marketing escrita + comercial', true),
  ('06010000-0000-4000-8000-0000000000a3', '[TESTE] S01 so pcm', true),
  ('06010000-0000-4000-8000-0000000000a4', '[TESTE] S01 marketing escrita sem comercial', true);

insert into config.grupo_modulos (grupo_id, modulo, nivel) values
  ('06010000-0000-4000-8000-0000000000a1', 'marketing', 'leitura'),
  ('06010000-0000-4000-8000-0000000000a2', 'marketing', 'escrita'),
  ('06010000-0000-4000-8000-0000000000a2', 'comercial', 'leitura'),
  ('06010000-0000-4000-8000-0000000000a3', 'pcm', 'escrita'),
  ('06010000-0000-4000-8000-0000000000a4', 'marketing', 'escrita');

insert into config.usuarios (user_id, papel, nome, ativo, grupo_id) values
  ('06010000-0000-4000-8000-000000000001', 'colaborador', 'Leitura S01', true,
   '06010000-0000-4000-8000-0000000000a1'),
  ('06010000-0000-4000-8000-000000000002', 'colaborador', 'Escrita S01', true,
   '06010000-0000-4000-8000-0000000000a2'),
  ('06010000-0000-4000-8000-000000000003', 'colaborador', 'Sem modulo S01', true,
   '06010000-0000-4000-8000-0000000000a3'),
  ('06010000-0000-4000-8000-000000000004', 'colaborador', 'Sem comercial S01', true,
   '06010000-0000-4000-8000-0000000000a4')
on conflict (user_id) do nothing;

-- Hierarquia e métrica semeadas por fora da RLS (é setup, não é o que está sendo provado).
insert into marketing.contas_anuncio (id, plataforma, conta_externa_id, nome)
  values ('06010000-0000-4000-8000-0000000000b0', 'meta', '9001', 'Conta S01');
insert into marketing.campanhas (id, conta_id, campanha_externa_id, nome)
  values ('06010000-0000-4000-8000-0000000000b1', '06010000-0000-4000-8000-0000000000b0',
          '8001', 'Campanha S01');
insert into marketing.conjuntos (id, campanha_id, conjunto_externo_id, nome)
  values ('06010000-0000-4000-8000-0000000000c1', '06010000-0000-4000-8000-0000000000b1',
          '7001', 'Conjunto S01');
insert into marketing.anuncios (id, conjunto_id, anuncio_externo_id, nome)
  values ('06010000-0000-4000-8000-0000000000d1', '06010000-0000-4000-8000-0000000000c1',
          '6001', 'Anuncio S01');
insert into marketing.metricas_anuncio_dia
  (anuncio_id, dia, gasto_centavos, alcance, impressoes, cliques, leads)
  values ('06010000-0000-4000-8000-0000000000d1', current_date - 1, 10000, 500, 900, 30, 3);
insert into marketing.links_rastreados (id, anuncio_id, token, url_destino)
  values ('06010000-0000-4000-8000-0000000000e1', '06010000-0000-4000-8000-0000000000d1',
          'tokendeteste', 'https://sinergica.example/chegada');

-- Lado Comercial, para a prova da receita e do vínculo.
insert into pcm.clientes (id, nome, ativo, created_by)
  values ('06010000-0000-4000-8000-0000000000f1', 'Cliente S01', true,
          '06010000-0000-4000-8000-000000000002');
insert into comercial.etapas_funil (id, nome, ordem, cor)
  values ('06010000-0000-4000-8000-0000000000f2', 'Etapa S01', 991, '#000');
insert into comercial.oportunidades (id, cliente_id, etapa_id, titulo)
  values ('06010000-0000-4000-8000-0000000000f3', '06010000-0000-4000-8000-0000000000f1',
          '06010000-0000-4000-8000-0000000000f2', 'Oportunidade S01');
insert into comercial.propostas (id, oportunidade_id, tipo, preco_centavos)
  values ('06010000-0000-4000-8000-0000000000f4', '06010000-0000-4000-8000-0000000000f3',
          'volante', 250000);
insert into comercial.contratos (id, proposta_id, cliente_id, tipo, vigencia_inicio,
                                 valor_mensal_centavos, status)
  values ('06010000-0000-4000-8000-0000000000f5', '06010000-0000-4000-8000-0000000000f4',
          '06010000-0000-4000-8000-0000000000f1', 'volante', current_date - 30, 180000, 'ativo');

-- ─── AC-8/AC-12: leitura ────────────────────────────────────────────────────
set local role authenticated;

set local request.jwt.claims = '{"sub":"06010000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
select is(
  (select count(*)::int from marketing.metricas_anuncio_dia
     where anuncio_id = '06010000-0000-4000-8000-0000000000d1'),
  1,
  'marketing leitura LE metrica do anuncio'
);

set local request.jwt.claims = '{"sub":"06010000-0000-4000-8000-000000000003","role":"authenticated","user_role":"colaborador"}';
select is(
  (select count(*)::int from marketing.metricas_anuncio_dia),
  0,
  'sem modulo marketing NAO le metrica (RLS silencia a linha)'
);
select is(
  (select count(*)::int from marketing.campanhas),
  0,
  'sem modulo marketing NAO le campanha'
);

-- ─── AC-12: escrita ─────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"06010000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
select throws_ok(
  $$ insert into marketing.metricas_anuncio_dia (anuncio_id, dia, gasto_centavos)
       values ('06010000-0000-4000-8000-0000000000d1', current_date - 5, 100) $$,
  '42501',
  null,
  'marketing leitura NAO grava metrica'
);
select throws_ok(
  $$ select marketing.fn_registrar_entrada_anuncio('tokendeteste', 'Fulano', null, null, now()) $$,
  '42501',
  null,
  'marketing leitura NAO registra entrada (checagem no servidor, nao na UI)'
);

set local request.jwt.claims = '{"sub":"06010000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
select lives_ok(
  $$ insert into marketing.metricas_anuncio_dia (anuncio_id, dia, gasto_centavos)
       values ('06010000-0000-4000-8000-0000000000d1', current_date - 5, 100) $$,
  'marketing escrita grava metrica'
);

-- ─── AC-9: idempotência do grão (anuncio_id, dia) ───────────────────────────
select lives_ok(
  $$ insert into marketing.metricas_anuncio_dia
       (anuncio_id, dia, gasto_centavos, impressoes, cliques, leads)
     values ('06010000-0000-4000-8000-0000000000d1', current_date - 5, 777, 10, 2, 1)
     on conflict (anuncio_id, dia) do update
       set gasto_centavos = excluded.gasto_centavos, impressoes = excluded.impressoes,
           cliques = excluded.cliques, leads = excluded.leads $$,
  'reprocessar o mesmo dia e um upsert, nao um erro'
);
select is(
  (select count(*)::int from marketing.metricas_anuncio_dia
     where anuncio_id = '06010000-0000-4000-8000-0000000000d1' and dia = current_date - 5),
  1,
  'reprocessar NAO duplica a metrica do dia'
);
select is(
  (select gasto_centavos from marketing.metricas_anuncio_dia
     where anuncio_id = '06010000-0000-4000-8000-0000000000d1' and dia = current_date - 5),
  777::bigint,
  'reprocessar passa a valer o numero revisado'
);

-- ─── AC-13/AC-14: entrada com e sem origem ──────────────────────────────────
select lives_ok(
  $$ select marketing.fn_registrar_entrada_anuncio('tokendeteste', 'Com Origem', null, null, now()) $$,
  'marketing escrita registra a entrada vinda do link rastreado'
);
select lives_ok(
  $$ select marketing.fn_registrar_entrada_anuncio('semorigemxyz', 'Sem Origem', null, null, now()) $$,
  'token desconhecido nao recusa a entrada'
);
select is(
  (select anuncio_id from marketing.entradas_anuncio where token_recebido = 'semorigemxyz'),
  null::uuid,
  'token desconhecido grava entrada SEM origem (nunca atribui ao anuncio errado)'
);
select is(
  (select anuncio_id from marketing.entradas_anuncio where token_recebido = 'tokendeteste'),
  '06010000-0000-4000-8000-0000000000d1'::uuid,
  'token conhecido atribui a entrada ao anuncio do link'
);

-- ─── AC-15: vínculo único por oportunidade ──────────────────────────────────
select lives_ok(
  $$ select marketing.fn_vincular_oportunidade(
       (select id from marketing.entradas_anuncio where token_recebido = 'tokendeteste'),
       '06010000-0000-4000-8000-0000000000f3') $$,
  'vincula a entrada a oportunidade do Comercial'
);
select throws_ok(
  $$ select marketing.fn_vincular_oportunidade(
       (select id from marketing.entradas_anuncio where token_recebido = 'semorigemxyz'),
       '06010000-0000-4000-8000-0000000000f3') $$,
  '23505',
  null,
  'a mesma oportunidade NAO e creditada a duas entradas'
);

-- ─── AC-16/AC-17: receita por campanha exige os dois módulos ────────────────
select lives_ok(
  $$ select * from marketing.fn_receita_por_campanha(current_date - 30, current_date) $$,
  'com marketing E comercial, a receita por campanha e lida'
);

-- Ator 004 tem escrita no marketing e NENHUM acesso ao comercial.
set local request.jwt.claims = '{"sub":"06010000-0000-4000-8000-000000000004","role":"authenticated","user_role":"colaborador"}';
select throws_ok(
  $$ select * from marketing.fn_receita_por_campanha(current_date - 30, current_date) $$,
  '42501',
  null,
  'so marketing NAO le receita do Comercial'
);

-- Claim SEM `user_role`: `config.sso_acesso_atual` exige que o papel do token bata com o do
-- banco, então um token sem papel não concede nada. Antes da releitura ao vivo, a checagem era
-- `NULL in (...)` → NULL → `if NULL then raise` não disparava: fail-OPEN silencioso.
set local request.jwt.claims = '{"sub":"06010000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select * from marketing.fn_receita_por_campanha(current_date - 30, current_date) $$,
  '42501',
  null,
  'token sem papel NAO le receita (nao passa por NULL)'
);
select throws_ok(
  $$ select marketing.fn_registrar_entrada_anuncio('tokendeteste', 'Ninguem', null, null, now()) $$,
  '42501',
  null,
  'token sem papel NAO registra entrada (nao passa por NULL)'
);

-- ─── AC-11: histórico de sincronização é append-only ────────────────────────
set local request.jwt.claims = '{"sub":"06010000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
insert into marketing.sincronizacoes
  (id, conta_id, janela_de, janela_ate, origem, resultado)
values ('06010000-0000-4000-8000-0000000000aa', '06010000-0000-4000-8000-0000000000b0',
        current_date - 6, current_date, 'demonstracao', 'sucesso');
select throws_ok(
  $$ update marketing.sincronizacoes set resultado = 'falha'
       where id = '06010000-0000-4000-8000-0000000000aa' $$,
  '42501',
  null,
  'historico de sincronizacao nao se reescreve (append-only, sem GRANT de update)'
);

reset role;
select * from finish();
rollback;
