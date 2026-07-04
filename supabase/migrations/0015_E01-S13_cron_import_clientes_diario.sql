-- 0015_E01-S13_cron_import_clientes_diario.sql — Sinérgica SO
-- Story E01-S13 (AC-5). Agenda o import diário de clientes do Auvo → PCM via `pg_cron`, chamando
-- a Edge Function `pcm-auvo-customers-import` com `net.http_post` (mesmo padrão de `0013` —
-- E01-S11). Roda às 06:00 UTC = 03:00 BRT, fora do horário comercial (spec.md → AC-5).
--
-- Reaproveita os MESMOS secrets do Vault já criados em `0011`/`0013`
-- (`auvo_trigger_project_url` / `auvo_trigger_service_role_key`) — genéricos, não específicos da
-- OS/técnicos; nenhum segredo novo. Sem esses secrets no Vault, a função roda em no-op silencioso
-- (RAISE WARNING), sem quebrar nada — igual a `0011`/`0013`.
--
-- AC-5b (invocação sob demanda): não precisa de nada novo — a mesma Edge Function aceita
-- `Authorization: Bearer <service_role_key>` (requireServiceRole). É o caminho que resolve o
-- bootstrap imediato: rodar manualmente uma vez após o deploy, sem esperar o cron das 06:00 UTC.
--
-- Pré-requisito operacional (fora do alcance de agente sem acesso ao Dashboard): a extensão
-- `pg_cron` precisa estar habilitada no projeto Supabase — mesma pendência já registrada em
-- `0013`/tasks.md de E01-S11 (é a mesma extensão, já deveria estar habilitada se E01-S11 foi
-- deployada; `create extension if not exists` abaixo é idempotente e inofensivo se já existir).
--
-- Reverso:
--   select cron.unschedule('import_clientes_auvo_diario');
--   drop function if exists pcm.fn_auvo_import_clientes_diario();
--   -- extensões pg_cron/pg_net NÃO são removidas no reverso (podem já estar em uso por 0013).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

create or replace function pcm.fn_auvo_import_clientes_diario()
returns void
language plpgsql
security definer
set search_path = pcm, extensions, vault, public
as $$
declare
  v_project_url text;
  v_service_role_key text;
  v_headers jsonb;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;

  -- Sem secrets configurados, não dispara — no-op silencioso (mesmo comportamento de 0011/0013).
  -- O import pode ser rodado manualmente até os secrets existirem (AC-5b).
  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_auvo_import_clientes_diario: secrets do Vault ausentes (auvo_trigger_project_url/auvo_trigger_service_role_key) — import diário pulado';
    return;
  end if;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_service_role_key
  );

  select net.http_post(
    url := v_project_url || '/functions/v1/pcm-auvo-customers-import',
    headers := v_headers,
    body := '{}'::jsonb
  ) into v_request_id;
exception
  when others then
    -- Nunca propaga — um erro no disparo não deve derrubar o job do cron nem poluir o Postgres.
    raise warning 'fn_auvo_import_clientes_diario: falha ao disparar pg_net — %', SQLERRM;
end;
$$;

-- Agenda diária às 06:00 UTC (03:00 BRT). `cron.schedule` é idempotente por jobname: reaplicar a
-- migration com o mesmo nome atualiza o agendamento em vez de duplicar.
select cron.schedule(
  'import_clientes_auvo_diario',
  '0 6 * * *',
  'select pcm.fn_auvo_import_clientes_diario();'
);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule, command from cron.job where jobname = 'import_clientes_auvo_diario';
-- select 1 from pg_extension where extname = 'pg_cron';
-- -- disparo manual de teste (após configurar os secrets do Vault) — resolve o bootstrap imediato:
-- select pcm.fn_auvo_import_clientes_diario();
