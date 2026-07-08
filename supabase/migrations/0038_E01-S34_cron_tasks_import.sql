-- 0038_E01-S34_cron_tasks_import.sql — Sinérgica SO
-- Agenda `pcm-auvo-tasks-import` diariamente (backfill de tarefas antigas + rede de segurança pro
-- que o webhook de Task perder). Mesmo padrão de 0013 (cron de sync diário) e 0015
-- (`pcm-auvo-customers-import`). Reusa os MESMOS secrets do Vault de 0011/0013 — nenhum novo.
--
-- Horário 05:00 UTC — 1h antes do cron de catálogo (0037, 06:00 UTC) pra não competir por rate
-- limit do Auvo no mesmo minuto (ver design.md → Riscos).
--
-- Reverso:
--   select cron.unschedule('pcm_auvo_tasks_import_diario');
--   drop function if exists pcm.fn_auvo_tasks_import();

create or replace function pcm.fn_auvo_tasks_import()
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

  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_auvo_tasks_import: secrets do Vault ausentes — import pulado';
    return;
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/pcm-auvo-tasks-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  ) into v_request_id;
exception
  when others then
    raise warning 'fn_auvo_tasks_import: falha ao disparar pg_net — %', SQLERRM;
end;
$$;

select cron.schedule(
  'pcm_auvo_tasks_import_diario',
  '0 5 * * *',
  'select pcm.fn_auvo_tasks_import();'
);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule, command from cron.job where jobname = 'pcm_auvo_tasks_import_diario';
-- -- disparo manual de teste (após configurar os secrets do Vault):
-- select pcm.fn_auvo_tasks_import();
