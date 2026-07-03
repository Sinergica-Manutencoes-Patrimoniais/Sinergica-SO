-- tecnicos_equipamentos_cache_rls.test.sql — pgTAP (E01-S11, AC-3)
-- Prova que o cache de técnicos/equipamentos é read-only do ponto de vista do PCM:
--   • `authenticated` com módulo `pcm` LÊ (AC-1/AC-2 dependem da UI conseguir ler).
--   • `authenticated` NÃO consegue INSERT/UPDATE/DELETE (AC-3) — mesmo com o módulo em 'escrita'.
--   • `service_role` (Edge Functions de sync) grava normalmente (bypassa RLS).
-- Rodar no Supabase local: `supabase test db` (requer Docker, não roda na CI unitária sem banco).
--
-- Nota pgTAP (ver db/rls-test.md → "Pegadinha throws_ok"): a pegadinha do FILTRO silencioso
-- (UPDATE/DELETE completam 0 linhas sem lançar) só vale quando o role TEM o GRANT da operação e é a
-- RLS que barra. Aqui `authenticated` recebeu SÓ `grant select` (0012) — sem GRANT de INSERT/UPDATE/
-- DELETE, o Postgres nega no nível de ACL (`42501 permission denied for table`) ANTES de avaliar a
-- RLS. Logo as TRÊS operações de escrita LANÇAM exceção e são testadas com `throws_ok` (defesa mais
-- estrita que a esperada — o cache é read-only de fato para authenticated). Achado pelo @qa.

begin;
select plan(9);

-- ── Semente: insere direto como superuser da migration (bypassa RLS) via role postgres ──────────
-- Um técnico e um equipamento "de fábrica" para os testes de leitura (isnt_empty) de authenticated.
insert into pcm.tecnicos_cache (auvo_user_id, nome, equipe, ativo)
  values (900001, 'Técnico Semente', 'Equipe A', true);
insert into pcm.equipamentos_cache (auvo_equipment_id, nome, ativo)
  values (900002, 'Equipamento Semente', true);

-- ── authenticated COM módulo pcm em 'escrita' — mesmo assim NÃO escreve (AC-3) ───────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"u1","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';

-- LÊ (AC-1/AC-2): a UI do PCM precisa conseguir listar.
select isnt_empty(
  $$ select 1 from pcm.tecnicos_cache where auvo_user_id = 900001 $$,
  'authenticated com modulo pcm LE tecnicos_cache'
);
select isnt_empty(
  $$ select 1 from pcm.equipamentos_cache where auvo_equipment_id = 900002 $$,
  'authenticated com modulo pcm LE equipamentos_cache'
);

-- INSERT bloqueado — lança exceção (deny policy + sem GRANT insert).
select throws_ok(
  $$ insert into pcm.tecnicos_cache (auvo_user_id, nome) values (900003, 'X') $$,
  '42501',
  null,
  'authenticated NAO insere em tecnicos_cache (AC-3)'
);
select throws_ok(
  $$ insert into pcm.equipamentos_cache (auvo_equipment_id, nome) values (900004, 'Y') $$,
  '42501',
  null,
  'authenticated NAO insere em equipamentos_cache (AC-3)'
);

-- UPDATE bloqueado — lança exceção 42501 (sem GRANT update → ACL nega antes da RLS).
select throws_ok(
  $$ update pcm.tecnicos_cache set nome = 'HACKEADO' where auvo_user_id = 900001 $$,
  '42501',
  null,
  'authenticated NAO edita tecnicos_cache (AC-3)'
);
select throws_ok(
  $$ update pcm.equipamentos_cache set nome = 'HACKEADO' where auvo_equipment_id = 900002 $$,
  '42501',
  null,
  'authenticated NAO edita equipamentos_cache (AC-3)'
);

-- DELETE bloqueado — lança exceção 42501 (sem GRANT delete → ACL nega antes da RLS).
select throws_ok(
  $$ delete from pcm.tecnicos_cache where auvo_user_id = 900001 $$,
  '42501',
  null,
  'authenticated NAO apaga tecnicos_cache (AC-3)'
);
select throws_ok(
  $$ delete from pcm.equipamentos_cache where auvo_equipment_id = 900002 $$,
  '42501',
  null,
  'authenticated NAO apaga equipamentos_cache (AC-3)'
);

reset role;

-- ── service_role escreve (bypassa RLS) — é quem as Edge Functions de sync usam ───────────────────
set local role service_role;
select lives_ok(
  $$ insert into pcm.tecnicos_cache (auvo_user_id, nome) values (900005, 'Sync Insere') $$,
  'service_role INSERE em tecnicos_cache (Edge Function de sync)'
);
reset role;

select * from finish();
rollback;
