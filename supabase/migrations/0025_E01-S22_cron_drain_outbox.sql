-- 0025_E01-S22_cron_drain_outbox.sql — Sinérgica SO
-- Story E01-S22. Agenda o drain do outbox de sync PCM→Auvo (`pcm.auvo_sync_outbox`) a cada 1
-- minuto via `pg_cron`, chamando a Edge Function `pcm-auvo-push` com `net.http_post` (mesmo
-- padrão do trigger de 0011 e do cron diário de 0013 — E01-S09/E01-S11).
--
-- Reaproveita os MESMOS secrets do Vault já criados para 0011 (`auvo_trigger_project_url` /
-- `auvo_trigger_service_role_key`) — nenhum segredo novo. Sem esses secrets no Vault, a função
-- roda em no-op silencioso (RAISE WARNING), sem quebrar nada — igual a 0011/0013.
--
-- Cadência de 1 min (bem mais frequente que o sync diário de 0013) é segura para o rate limit do
-- Auvo (400 req/min) porque o drain processa no máximo `BATCH_SIZE` (20) linhas por invocação —
-- ver specs/E01-S22-motor-sync-auvo-write/design.md → Questões em aberto.
--
-- Pré-requisito operacional (mesma ressalva de 0011/0013): `pg_cron` precisa estar habilitado no
-- projeto Supabase (Dashboard → Database → Extensions) em ambientes hospedados.
--
-- Reverso:
--   select cron.unschedule('pcm_auvo_push_drain');
--   drop function if exists pcm.fn_auvo_push_drain();
--   -- extensões pg_cron/pg_net NÃO são removidas no reverso (podem já estar em uso por outra migration).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

create or replace function pcm.fn_auvo_push_drain()
returns void
language plpgsql
security definer
set search_path = pcm, extensions, vault, public
as $$
declare
  v_project_url text;
  v_service_role_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;

  -- Sem secrets configurados, não dispara — no-op silencioso (mesmo comportamento de 0011/0013).
  -- A outbox só acumula linhas `pending`; nada é perdido até o drain começar a rodar de verdade.
  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_auvo_push_drain: secrets do Vault ausentes (auvo_trigger_project_url/auvo_trigger_service_role_key) — drain pulado';
    return;
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/pcm-auvo-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  ) into v_request_id;
exception
  when others then
    -- Nunca propaga — um erro no disparo não deve derrubar o job do cron. Visível via RAISE
    -- WARNING nos logs (Dashboard → Logs); reconciliação manual nesta fase (design.md → Riscos).
    raise warning 'fn_auvo_push_drain: falha ao disparar pg_net — %', SQLERRM;
end;
$$;

-- A cada 1 minuto. `cron.schedule` é idempotente por jobname: reaplicar a migration com o mesmo
-- nome atualiza o agendamento em vez de duplicar.
select cron.schedule(
  'pcm_auvo_push_drain',
  '* * * * *',
  'select pcm.fn_auvo_push_drain();'
);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule, command from cron.job where jobname = 'pcm_auvo_push_drain';
-- select 1 from pg_extension where extname = 'pg_cron';
-- -- disparo manual de teste (após configurar os secrets do Vault):
-- select pcm.fn_auvo_push_drain();
