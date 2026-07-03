-- tecnicos_equipamentos_cache_rls.test.sql — pgTAP (E01-S11, AC-3)
-- Prova que o cache de técnicos/equipamentos é read-only do ponto de vista do PCM:
--   • `authenticated` com módulo `pcm` LÊ (AC-1/AC-2 dependem da UI conseguir ler).
--   • `authenticated` NÃO consegue INSERT/UPDATE/DELETE (AC-3) — mesmo com o módulo em 'escrita'.
--   • `service_role` (Edge Functions de sync) grava normalmente (bypassa RLS).
-- Rodar no Supabase local: `supabase test db` (requer Docker, não roda na CI unitária sem banco).
--
-- Nota pgTAP (ver db/rls-test.md → "Pegadinha throws_ok"): INSERT bloqueado LANÇA exceção
-- (throws_ok funciona); UPDATE/DELETE bloqueados apenas FILTRAM (0 linhas, sem exceção) — testados
-- por EFEITO (a linha semente permanece inalterada / não é apagada).

begin;
select plan(9);

-- ── Semente: insere direto como superuser da migration (bypassa RLS) via role postgres ──────────
-- Um técnico e um equipamento "de fábrica" para os testes de UPDATE/DELETE filtrados.
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

-- UPDATE bloqueado — filtra (0 linhas afetadas, sem exceção). Testa por efeito: nome inalterado.
update pcm.tecnicos_cache set nome = 'HACKEADO' where auvo_user_id = 900001;
select is(
  (select nome from pcm.tecnicos_cache where auvo_user_id = 900001),
  'Técnico Semente',
  'authenticated NAO edita tecnicos_cache (RLS filtra, 0 afetadas) (AC-3)'
);
update pcm.equipamentos_cache set nome = 'HACKEADO' where auvo_equipment_id = 900002;
select is(
  (select nome from pcm.equipamentos_cache where auvo_equipment_id = 900002),
  'Equipamento Semente',
  'authenticated NAO edita equipamentos_cache (RLS filtra, 0 afetadas) (AC-3)'
);

-- DELETE bloqueado — filtra (0 linhas). Testa por efeito: a linha continua existindo.
delete from pcm.tecnicos_cache where auvo_user_id = 900001;
select isnt_empty(
  $$ select 1 from pcm.tecnicos_cache where auvo_user_id = 900001 $$,
  'authenticated NAO apaga tecnicos_cache (RLS filtra, 0 afetadas) (AC-3)'
);
delete from pcm.equipamentos_cache where auvo_equipment_id = 900002;
select isnt_empty(
  $$ select 1 from pcm.equipamentos_cache where auvo_equipment_id = 900002 $$,
  'authenticated NAO apaga equipamentos_cache (RLS filtra, 0 afetadas) (AC-3)'
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
