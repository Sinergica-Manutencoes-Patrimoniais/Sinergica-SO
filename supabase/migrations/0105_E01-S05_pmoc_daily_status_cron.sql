-- 0105_E01-S05_pmoc_daily_status_cron.sql — Sinérgica SO
-- Cron diário que marca visitas PMOC vencidas como atrasadas (blueprint: `pmoc-daily-status`,
-- diário 00:01). SQL puro — sem Edge Function/HTTP, mais barato e verificável que o padrão
-- Auvo (pg_net) usado em 0025, porque não precisa chamar nada externo, só um UPDATE local.
-- O painel de alertas de E01-S08 (`contratosComAlerta`) já mostra isso ao vivo — este cron só
-- mantém o `status` correto na tabela, não notifica ninguém.
--
-- Reverso:
--   select cron.unschedule('pmoc_daily_status');
--   drop function if exists pcm.fn_pmoc_marcar_atrasadas();

create or replace function pcm.fn_pmoc_marcar_atrasadas()
returns void
language sql
as $$
  update pcm.pmoc_schedules
  set status = 'atrasado'
  where status = 'agendado'
    and scheduled_date < current_date;
$$;

-- Diário às 00:01 UTC (blueprint). `cron.schedule` é idempotente por jobname — reaplicar a
-- migration atualiza o agendamento em vez de duplicar.
select cron.schedule(
  'pmoc_daily_status',
  '1 0 * * *',
  'select pcm.fn_pmoc_marcar_atrasadas();'
);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule, command from cron.job where jobname = 'pmoc_daily_status';
-- -- disparo manual de teste:
-- select pcm.fn_pmoc_marcar_atrasadas();
