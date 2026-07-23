-- 0141_E01-S92_parametros_apontamento_horas.sql — Sinérgica SO
-- Parâmetros globais das visualizações de produtividade/consistência/anomalias.
-- Reverso: drop table if exists config.parametros_apontamento_horas;

create table config.parametros_apontamento_horas (
  id                       int primary key default 1 check (id = 1),
  meta_diaria_horas        numeric(4,2) not null default 8 check (meta_diaria_horas > 0 and meta_diaria_horas <= 24),
  tolerancia_minutos       int not null default 15 check (tolerancia_minutos between 0 and 480),
  limiar_anomalia_minutos  int not null default 5 check (limiar_anomalia_minutos between 1 and 480),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references auth.users (id)
);

alter table config.parametros_apontamento_horas enable row level security;
alter table config.parametros_apontamento_horas force row level security;

grant select on config.parametros_apontamento_horas to authenticated;
grant insert, update on config.parametros_apontamento_horas to authenticated;
grant select, insert, update, delete on config.parametros_apontamento_horas to service_role;

create policy "parametros_apontamento_horas_select" on config.parametros_apontamento_horas
  for select to authenticated using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "parametros_apontamento_horas_escrita" on config.parametros_apontamento_horas
  for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

insert into config.parametros_apontamento_horas (id) values (1) on conflict (id) do nothing;
