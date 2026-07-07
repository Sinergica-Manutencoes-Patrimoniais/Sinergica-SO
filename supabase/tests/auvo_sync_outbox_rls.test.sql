-- auvo_sync_outbox_rls.test.sql — pgTAP (E01-S22, AC-1, AC-2, AC-3, AC-7)
-- Prova que:
--   • `pcm.auvo_sync_outbox` é infraestrutura pura — `authenticated` (mesmo superadmin) não lê
--     nem escreve (AC-7); `service_role` (Edge Function pcm-auvo-push) grava normalmente.
--   • `fn_auvo_enqueue()` enfileira create/update/delete(soft) numa escrita genuína (AC-1).
--   • Uma escrita aplicada via `fn_apply_auvo_sync` NÃO enfileira de volta (AC-2, anti-loop).
--   • `fn_claim_auvo_outbox_batch` reivindica cada linha pending uma única vez (AC-3, AC-5 →
--     corrida entre 2 disparos do drain nunca pega a mesma linha).
-- Rodar no Supabase local: `supabase test db` (requer Docker, não roda na CI unitária sem banco).
--
-- Tabela `pcm._test_auvo_enqueue` é criada só para este teste (DDL transacional — o `rollback`
-- final desfaz tudo, sem precisar de `drop table` manual).

begin;
select plan(12);

-- ── RLS da outbox (AC-7): nenhum acesso de authenticated, nem como superadmin ────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"u1","user_role":"superadmin"}';

select throws_ok(
  $$ select 1 from pcm.auvo_sync_outbox $$,
  '42501',
  null,
  'authenticated (mesmo superadmin) NAO le auvo_sync_outbox (AC-7)'
);
select throws_ok(
  $$ insert into pcm.auvo_sync_outbox (entity, row_id, op) values ('x', gen_random_uuid(), 'create') $$,
  '42501',
  null,
  'authenticated NAO insere em auvo_sync_outbox (AC-7)'
);
select throws_ok(
  $$ update pcm.auvo_sync_outbox set status = 'sent' $$,
  '42501',
  null,
  'authenticated NAO edita auvo_sync_outbox (AC-7)'
);
select throws_ok(
  $$ delete from pcm.auvo_sync_outbox $$,
  '42501',
  null,
  'authenticated NAO apaga auvo_sync_outbox (AC-7)'
);
reset role;

-- ── service_role escreve normalmente (é quem pcm-auvo-push usa) ──────────────────────────────────
set local role service_role;
select lives_ok(
  $$ insert into pcm.auvo_sync_outbox (entity, row_id, op) values ('smoke', gen_random_uuid(), 'create') $$,
  'service_role insere em auvo_sync_outbox'
);
reset role;

-- ── fn_auvo_enqueue: tabela dummy com a trigger genérica anexada (AC-1, AC-2) ────────────────────
create table pcm._test_auvo_enqueue (
  id         uuid primary key default gen_random_uuid(),
  nome       text,
  deleted_at timestamptz
);
create trigger trg_test_enqueue
  after insert or update or delete on pcm._test_auvo_enqueue
  for each row execute function pcm.fn_auvo_enqueue('_test_entity');

set local role service_role;

-- INSERT genuíno enfileira op='create' (AC-1).
insert into pcm._test_auvo_enqueue (nome) values ('linha 1');
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = '_test_entity' and op = 'create'),
  1,
  'INSERT genuino enfileira op=create (AC-1)'
);

-- UPDATE genuíno (não soft-delete) enfileira op='update'.
update pcm._test_auvo_enqueue set nome = 'linha 1 editada' where nome = 'linha 1';
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = '_test_entity' and op = 'update'),
  1,
  'UPDATE genuino enfileira op=update (AC-1)'
);

-- Soft-delete (deleted_at preenchido) enfileira op='delete', não 'update'.
update pcm._test_auvo_enqueue set deleted_at = now() where nome = 'linha 1 editada';
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = '_test_entity' and op = 'delete'),
  1,
  'soft-delete enfileira op=delete, nao op=update (AC-1)'
);

-- fn_apply_auvo_sync aplica o patch mas NÃO gera nova linha no outbox (AC-2, anti-loop) — contagem
-- por entity continua em 3 (create + update + delete de antes), não vira 4.
select pcm.fn_apply_auvo_sync(
  '_test_auvo_enqueue',
  (select id from pcm._test_auvo_enqueue limit 1),
  '{"nome": "via sync"}'::jsonb
);
select is(
  (select count(*)::int from pcm.auvo_sync_outbox where entity = '_test_entity'),
  3,
  'escrita via fn_apply_auvo_sync NAO enfileira (AC-2, anti-loop)'
);
select is(
  (select nome from pcm._test_auvo_enqueue limit 1),
  'via sync',
  'fn_apply_auvo_sync efetivamente aplicou o patch (anti-loop nao e so um no-op)'
);

-- fn_claim_auvo_outbox_batch: reivindica todas as pending (smoke + create/update/delete = 4) numa
-- unica chamada, e uma segunda chamada nao pega as mesmas linhas (agora 'processing', nao 'pending').
select is(
  (select count(*)::int from pcm.fn_claim_auvo_outbox_batch(100)),
  4,
  'fn_claim_auvo_outbox_batch reivindica todas as pending disponiveis (AC-3)'
);
select is(
  (select count(*)::int from pcm.fn_claim_auvo_outbox_batch(100)),
  0,
  'reivindicar de novo nao repete as mesmas linhas (AC-3, AC-5 - corrida entre 2 disparos)'
);

reset role;

select * from finish();
rollback;
