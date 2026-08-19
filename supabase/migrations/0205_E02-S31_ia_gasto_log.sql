-- 0205_E02-S31_ia_gasto_log.sql — Sinérgica SO
-- E02-S31 AC-3: histórico de consumo de IA (OpenRouter) por módulo. Cada chamada bem-sucedida ao
-- OpenRouter que devolve `usage.cost` registra uma linha aqui — base pro dashboard de gasto
-- (AC-1), cálculo de quota (AC-2) e rodapé de custo na conversa do Atendimento (E02-S33).
-- Fica em `config` (não schema novo): é telemetria de uma integração que já mora em
-- `config.integracoes`, não um bounded context próprio.
--
-- RECONSTRUÍDA nesta sessão (E01-S146) a partir de `supabase_migrations.schema_migrations.statements`
-- — o arquivo original foi aplicado direto em produção sem nunca ser commitado neste repositório
-- (achado ao investigar colisão de número com 0210). Conteúdo reconstituído fiel ao aplicado; ver
-- STATE.md 2026-08-19 para o achado completo.
--
-- Reverso:
--   drop table if exists config.ia_gasto_log;

create table if not exists config.ia_gasto_log (
  id                 uuid        primary key default gen_random_uuid(),
  modulo             text        not null check (modulo in ('inspecao', 'atendimento', 'previsoes')),
  usd_cost           numeric(12, 6) not null check (usd_cost >= 0),
  modelo             text,
  prompt_tokens      integer,
  completion_tokens  integer,
  ref_id             uuid,                    -- id do item de origem (mensagem, inspeção…), sem FK — módulos diferentes
  endpoint           text,                    -- nome da Edge Function que gerou o gasto
  created_at         timestamptz not null default now()
);

alter table config.ia_gasto_log enable row level security;
alter table config.ia_gasto_log force row level security;

grant usage on schema config to authenticated, service_role;
grant select on config.ia_gasto_log to authenticated;
grant select, insert on config.ia_gasto_log to service_role;

-- Leitura: superadmin e supervisor (mesmo público do dashboard financeiro/PCM). Escrita: só
-- service_role (Edge Function via `_shared/openrouter.ts`) — nunca o client grava gasto direto.
create policy "ia_gasto_log_select" on config.ia_gasto_log
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

create index if not exists ia_gasto_log_modulo_created_at_idx
  on config.ia_gasto_log (modulo, created_at desc);

create index if not exists ia_gasto_log_ref_id_idx
  on config.ia_gasto_log (ref_id)
  where ref_id is not null;
