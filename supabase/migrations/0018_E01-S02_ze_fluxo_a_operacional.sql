-- 0018_E01-S02_ze_fluxo_a_operacional.sql — Sinérgica SO
-- Story E01-S02. Operacionaliza o Fluxo A do Agente Zé: WhatsApp → fila → criação direta de OS.
--
-- As tabelas atendimento.config_ze, atendimento.wa_messages e atendimento.wa_queue já existem
-- desde 0001. Esta migration adiciona privilégios para Edge Functions (`service_role`), índices
-- úteis para agrupamento/fallback e cron de reprocessamento.

grant usage on schema atendimento to service_role;
grant select, insert, update, delete on atendimento.config_ze to service_role;
grant select, insert, update, delete on atendimento.wa_messages to service_role;
grant select, insert, update, delete on atendimento.wa_queue to service_role;
grant select, insert, update on pcm.ordens_servico to service_role;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create or replace function atendimento.fn_process_wa_queue_fallback()
returns void
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  project_url text;
  service_key text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'ze_agent_project_url';

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'ze_agent_service_role_key';

  if project_url is null or service_key is null then
    raise warning 'Segredos ze_agent_project_url/ze_agent_service_role_key ausentes; fallback Zé não invocado';
    return;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/pcm-ze-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
exception when others then
  raise warning 'Falha ao invocar fallback pcm-ze-agent: %', sqlerrm;
end;
$$;

select cron.unschedule('process_wa_queue_ze_minutely')
where exists (
  select 1 from cron.job where jobname = 'process_wa_queue_ze_minutely'
);

select cron.schedule(
  'process_wa_queue_ze_minutely',
  '* * * * *',
  'select atendimento.fn_process_wa_queue_fallback();'
);
