-- 0013_E01-S11_cron_sync_auvo_diario.sql — Sinérgica SO
-- Story E01-S11 (AC-5). Agenda o sync diário de técnicos/equipes/equipamentos do Auvo → PCM via
-- `pg_cron`, chamando as Edge Functions `pcm-auvo-users-sync` e `pcm-auvo-equipment-sync` com
-- `net.http_post` (mesmo padrão do trigger de 0011 — E01-S09). Roda às 06:00 UTC = 03:00 BRT,
-- fora do horário comercial (spec.md → Casos de borda).
--
-- Reaproveita os MESMOS secrets do Vault já criados para 0011 (`auvo_trigger_project_url` /
-- `auvo_trigger_service_role_key`) — são genéricos (URL do projeto + service_role key), não
-- específicos da OS; nenhum segredo novo. Sem esses secrets no Vault, a função roda em no-op
-- silencioso (RAISE WARNING), sem quebrar nada — igual a 0011.
--
-- AC-5 (invocação sob demanda): não precisa de nada novo — a mesma Edge Function aceita
-- `Authorization: Bearer <service_role_key>` (requireServiceRole), então `supabase functions invoke
-- pcm-auvo-users-sync` / `curl` autenticado por ops/superadmin sincroniza sob demanda com o mesmo
-- caminho de auth que este cron usa.
--
-- Pré-requisito operacional (fora do alcance de agente sem acesso ao Dashboard, ver tasks.md
-- task 8): a extensão `pg_cron` precisa estar habilitada no projeto Supabase (Dashboard → Database
-- → Extensions). `create extension if not exists` abaixo cobre ambientes onde o role tem permissão;
-- em projetos hospedados pode ser necessário habilitar pelo Dashboard antes desta migration.
--
-- Reverso:
--   select cron.unschedule('sync_auvo_tecnicos_equipamentos_diario');
--   drop function if exists pcm.fn_auvo_sync_tecnicos_equipamentos_diario();
--   -- extensões pg_cron/pg_net NÃO são removidas no reverso (podem já estar em uso por outra migration).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

create or replace function pcm.fn_auvo_sync_tecnicos_equipamentos_diario()
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

  -- Sem secrets configurados, não dispara — no-op silencioso (mesmo comportamento de 0011). O sync
  -- pode ser rodado manualmente até os secrets existirem (AC-5b).
  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_auvo_sync_tecnicos_equipamentos_diario: secrets do Vault ausentes (auvo_trigger_project_url/auvo_trigger_service_role_key) — sync diário pulado';
    return;
  end if;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_service_role_key
  );

  -- Dispara as duas Edge Functions de sync (POST sem corpo relevante — a função não recebe input).
  select net.http_post(
    url := v_project_url || '/functions/v1/pcm-auvo-users-sync',
    headers := v_headers,
    body := '{}'::jsonb
  ) into v_request_id;

  select net.http_post(
    url := v_project_url || '/functions/v1/pcm-auvo-equipment-sync',
    headers := v_headers,
    body := '{}'::jsonb
  ) into v_request_id;
exception
  when others then
    -- Nunca propaga — um erro no disparo não deve derrubar o job do cron nem poluir o Postgres.
    -- Visível via RAISE WARNING nos logs (Dashboard → Logs).
    raise warning 'fn_auvo_sync_tecnicos_equipamentos_diario: falha ao disparar pg_net — %', SQLERRM;
end;
$$;

-- Agenda diária às 06:00 UTC (03:00 BRT). `cron.schedule` é idempotente por jobname: reaplicar a
-- migration com o mesmo nome atualiza o agendamento em vez de duplicar.
select cron.schedule(
  'sync_auvo_tecnicos_equipamentos_diario',
  '0 6 * * *',
  'select pcm.fn_auvo_sync_tecnicos_equipamentos_diario();'
);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule, command from cron.job where jobname = 'sync_auvo_tecnicos_equipamentos_diario';
-- select 1 from pg_extension where extname = 'pg_cron';   -- task 8: confirmar extensão habilitada
-- -- disparo manual de teste (após configurar os secrets do Vault):
-- select pcm.fn_auvo_sync_tecnicos_equipamentos_diario();
