-- 0059_E02-S18_atendimento_scoring_clusters.sql — Sinérgica SO
-- Abas "Scoring" (lead scoring por comportamento, singleton) e "Clusters" (E02-S18). Escopo
-- reduzido ao AC da story: regras + limiares num singleton `jsonb` (paridade heziomos
-- `lead_scoring_config`, sem os 5 sub-cards de peso fino) + CRUD simples de clusters.
--
-- Reverso:
--   drop table if exists atendimento.cluster_regras;
--   drop table if exists atendimento.lead_scoring_config;

create table if not exists atendimento.lead_scoring_config (
  id                       uuid        primary key default gen_random_uuid(),
  window_days              int         not null default 14,
  behavior_cap             int         not null default 50,
  rescore_cooldown_seconds int         not null default 90,
  score_reached_threshold  int         not null default 60,
  componentes              jsonb       not null default '{}'::jsonb,
  updated_at               timestamptz,
  updated_by               uuid        references auth.users
);

create table if not exists atendimento.cluster_regras (
  id           uuid        primary key default gen_random_uuid(),
  nome         text        not null,
  lead_tier    text        check (lead_tier in ('A', 'B', 'C', 'D')),
  segmento     text,
  subsegmento  text,
  prioridade   int         not null default 100,
  ativo        boolean     not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users
);

create index if not exists idx_cluster_regras_ativo
  on atendimento.cluster_regras (ativo, prioridade);

alter table atendimento.lead_scoring_config enable row level security;
alter table atendimento.lead_scoring_config force row level security;
alter table atendimento.cluster_regras       enable row level security;
alter table atendimento.cluster_regras       force row level security;

grant select, insert, update on atendimento.lead_scoring_config, atendimento.cluster_regras to authenticated;
grant select, insert, update, delete on atendimento.lead_scoring_config, atendimento.cluster_regras to service_role;

create policy "lead_scoring_config_select" on atendimento.lead_scoring_config
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "lead_scoring_config_insert" on atendimento.lead_scoring_config
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

create policy "lead_scoring_config_update" on atendimento.lead_scoring_config
  for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

create policy "cluster_regras_select" on atendimento.cluster_regras
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "cluster_regras_insert" on atendimento.cluster_regras
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "cluster_regras_update" on atendimento.cluster_regras
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

insert into atendimento.lead_scoring_config (window_days, behavior_cap, rescore_cooldown_seconds, score_reached_threshold)
select 14, 50, 90, 60
where not exists (select 1 from atendimento.lead_scoring_config);
