-- 0024_E01-S22_auvo_sync_outbox.sql — Sinérgica SO
-- Story E01-S22. Fundação do motor de sync PCM→Auvo: outbox transacional + trigger genérica de
-- enfileiramento + RPC de aplicação de patch com anti-loop. Ver
-- specs/E01-S22-motor-sync-auvo-write/{design.md,domain.md,spec.md} e ADR-0005.
--
-- Escrita/leitura EXCLUSIVA de `service_role` (Edge Function `pcm-auvo-push`, E01-S22, e o futuro
-- dispatcher/poller de E01-S23) — é infraestrutura pura, a UI nunca lê nem escreve aqui (AC-7).
--
-- Anti-loop (AC-2): em vez de um `updated_by` sentinela (a coluna tem `references auth.users`,
-- exigiria uma linha falsa na tabela gerenciada pelo Supabase Auth — descartado, ver design.md),
-- o motor usa um GUC transacional (`app.auvo_sync_write`) setado pela RPC `fn_apply_auvo_sync`
-- antes de aplicar um patch vindo do Auvo. `fn_auvo_enqueue()` checa esse GUC e pula o enqueue.
--
-- `fn_apply_auvo_sync` é genérica (schema `pcm` fixo, tabela/patch parametrizados) — usada tanto
-- pelo drain (E01-S22) quanto pelo dispatcher/poller inbound (E01-S23), para que TODA escrita que
-- se origina de dados do Auvo passe pelo mesmo mecanismo de anti-loop.
--
-- Reverso:
--   drop function if exists pcm.fn_apply_auvo_sync(text, uuid, jsonb);
--   drop function if exists pcm.fn_claim_auvo_outbox_batch(int);
--   drop function if exists pcm.fn_auvo_enqueue();
--   drop table if exists pcm.auvo_sync_outbox;

-- ─────────────────────────── OUTBOX ────────────────────────────────────────

create table if not exists pcm.auvo_sync_outbox (
  id           uuid        primary key default gen_random_uuid(),
  entity       text        not null,                    -- chave do entity registry, ex. 'funcionarios'
  row_id       uuid        not null,                     -- id da linha de origem em pcm.<entity>
  op           text        not null check (op in ('create', 'update', 'delete')),
  -- 'processing' existe só para a janela entre a reivindicação do lote (fn_claim_auvo_outbox_batch,
  -- abaixo) e o resultado da chamada Auvo — sem esse estado intermediário, duas invocações
  -- concorrentes do drain poderiam SELECT a mesma linha 'pending' antes de qualquer uma marcar
  -- 'sent'/'error' (PostgREST não expõe FOR UPDATE SKIP LOCKED diretamente; a reivindicação
  -- atômica precisa ser um UPDATE dentro de uma função, não um SELECT solto do lado do cliente).
  status       text        not null default 'pending' check (status in ('pending', 'processing', 'sent', 'error')),
  attempts     int         not null default 0,
  last_error   text,
  enqueued_at  timestamptz not null default now(),
  sent_at      timestamptz
);

-- Suporta o `WHERE status='pending' ORDER BY enqueued_at ... FOR UPDATE SKIP LOCKED` de
-- `fn_claim_auvo_outbox_batch` (abaixo) — reivindicação de lote em ordem FIFO por status.
create index if not exists idx_auvo_sync_outbox_status_enqueued
  on pcm.auvo_sync_outbox (status, enqueued_at);

alter table pcm.auvo_sync_outbox enable row level security;
alter table pcm.auvo_sync_outbox force  row level security;

-- Só service_role toca a outbox — nem SELECT para authenticated (AC-7: infraestrutura pura).
grant select, insert, update, delete on pcm.auvo_sync_outbox to service_role;

-- Defesa em profundidade (mesmo padrão de audit.events em 0001 e *_deny_* de 0012): mesmo sem
-- GRANT, authenticated não conseguiria nada — a policy torna a intenção explícita.
create policy "auvo_sync_outbox_deny_all_authenticated" on pcm.auvo_sync_outbox
  for all to authenticated
  using (false)
  with check (false);

-- ─────────────────────────── ANTI-LOOP: RPC de aplicação de patch ──────────

-- Aplica um patch jsonb genérico (colunas escalares: texto, número, boolean, timestamp) numa
-- linha de `pcm.<p_table>`, setando o GUC `app.auvo_sync_write` (local à transação) ANTES do
-- UPDATE — `fn_auvo_enqueue()` (abaixo) checa esse GUC e não enfileira essa escrita de volta pro
-- Auvo. `%I` em `p_table`/nomes de coluna evita injeção; `p_patch` vem sempre de código confiável
-- (descriptors do registry, nunca input direto de usuário).
create or replace function pcm.fn_apply_auvo_sync(
  p_table text,
  p_row_id uuid,
  p_patch jsonb
) returns void
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_set_clause text;
begin
  select string_agg(format('%I = %L', t.key, t.value), ', ')
    into v_set_clause
    from jsonb_each_text(p_patch) as t(key, value);

  if v_set_clause is null then
    return; -- patch vazio, nada a fazer
  end if;

  perform set_config('app.auvo_sync_write', 'true', true); -- true = local à transação corrente

  execute format('update pcm.%I set %s where id = $1', p_table, v_set_clause)
    using p_row_id;
end;
$$;

-- Só service_role invoca (via Edge Function) — bypassa RLS internamente por ser security definer,
-- mas o privilégio de EXECUTE ainda é checado.
revoke all on function pcm.fn_apply_auvo_sync(text, uuid, jsonb) from public;
grant execute on function pcm.fn_apply_auvo_sync(text, uuid, jsonb) to service_role;

-- ─────────────────────────── RESERVA ATÔMICA DE LOTE ───────────────────────

-- Chamada pelo drain (`pcm-auvo-push`, task 6) via `.rpc(...)` no lugar de um SELECT solto: o
-- `UPDATE ... FOR UPDATE SKIP LOCKED` roda inteiro dentro desta função, então duas invocações
-- concorrentes do cron nunca reivindicam a mesma linha (AC-3, AC-5 → "corrida entre 2 disparos").
create or replace function pcm.fn_claim_auvo_outbox_batch(p_limit int default 20)
returns setof pcm.auvo_sync_outbox
language sql
security definer
set search_path = pcm, public
as $$
  update pcm.auvo_sync_outbox
  set status = 'processing'
  where id in (
    select id from pcm.auvo_sync_outbox
    where status = 'pending'
    order by enqueued_at
    for update skip locked
    limit p_limit
  )
  returning *;
$$;

revoke all on function pcm.fn_claim_auvo_outbox_batch(int) from public;
grant execute on function pcm.fn_claim_auvo_outbox_batch(int) to service_role;

-- ─────────────────────────── TRIGGER GENÉRICA DE ENQUEUE ───────────────────

-- Anexada por tabela sincronizada com `create trigger ... execute function
-- pcm.fn_auvo_enqueue('<entity_key>')` — TG_ARGV[0] carrega a chave do registry (uma função, N
-- triggers, ver design.md → Componentes). Não enfileira quando o GUC de sync está ativo (anti-
-- loop, AC-2) nem quando a operação não altera nada observável (não há caso hoje, mas o guard de
-- soft-delete abaixo cobre INSERT/UPDATE/DELETE físico uniformemente).
create or replace function pcm.fn_auvo_enqueue()
returns trigger
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_entity text := TG_ARGV[0];
  v_row_id uuid;
  v_op text;
begin
  if current_setting('app.auvo_sync_write', true) = 'true' then
    if TG_OP = 'DELETE' then
      return OLD;
    end if;
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    v_row_id := OLD.id;
    v_op := 'delete';
  elsif TG_OP = 'INSERT' then
    v_row_id := NEW.id;
    v_op := 'create';
  else -- UPDATE
    v_row_id := NEW.id;
    if NEW.deleted_at is not null and OLD.deleted_at is null then
      v_op := 'delete'; -- soft-delete (padrão do projeto) — mapeado para o mesmo op que hard-delete
    else
      v_op := 'update';
    end if;
  end if;

  insert into pcm.auvo_sync_outbox (entity, row_id, op) values (v_entity, v_row_id, v_op);

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select tablename, policyname, cmd from pg_policies where tablename = 'auvo_sync_outbox';
-- select has_table_privilege('authenticated', 'pcm.auvo_sync_outbox', 'select'); -- deve ser f
-- select has_table_privilege('service_role', 'pcm.auvo_sync_outbox', 'insert'); -- deve ser t
-- select proname, prosecdef from pg_proc where proname in ('fn_apply_auvo_sync', 'fn_auvo_enqueue');
