-- 0084_E01-S67_auvo_sync_runs.sql — Sinérgica SO
-- Execução em background do botão "Sincronizar Auvo": tabela de progresso pra UI fazer polling
-- (sem Edge Function nova, select direto sob RLS) + sobe o cron de pcm-auvo-tasks-import de
-- diário pra horário (seguro agora que o cursor incremental do E01-S67 torna cada rodada barata).
--
-- Reverso:
--   drop table if exists pcm.auvo_sync_runs;
--   select cron.alter_job((select jobid from cron.job where jobname = 'pcm_auvo_tasks_import_diario'), schedule := '0 5 * * *');

create table if not exists pcm.auvo_sync_runs (
  id            uuid        primary key default gen_random_uuid(),
  status        text        not null default 'running' check (status in ('running','succeeded','failed')),
  ok            boolean,
  results       jsonb,
  requested_by  uuid        references auth.users,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists idx_auvo_sync_runs_started_at
  on pcm.auvo_sync_runs (started_at desc);

alter table pcm.auvo_sync_runs enable row level security;
alter table pcm.auvo_sync_runs force row level security;

grant select on pcm.auvo_sync_runs to authenticated;
grant select, insert, update on pcm.auvo_sync_runs to service_role;

create policy "auvo_sync_runs_select" on pcm.auvo_sync_runs
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

-- Cron: diário 05:00 → horário no minuto 0. Ver design.md (E01-S67, Mudança 3) — continua não
-- competindo com o cron de catálogo (0037, 06:00 UTC) porque roda no mesmo minuto `0`, apenas
-- mais vezes; custo por execução caiu (cursor incremental), não subiu.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'pcm_auvo_tasks_import_diario';
  if v_jobid is not null then
    perform cron.alter_job(v_jobid, schedule := '0 * * * *');
  end if;
end;
$$;

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule from cron.job where jobname = 'pcm_auvo_tasks_import_diario';
-- select * from pcm.auvo_sync_runs order by started_at desc limit 5;
