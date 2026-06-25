-- 0001_schemas_dominio.sql — Sinérgica OS
-- Cria os schemas dos 9 bounded contexts + governança.
-- Convenções (ver docs/ARCHITECTURE.md):
--   • schema  = lowercase_underscore (pcm, atendimento, comercial…)
--   • tabela  = snake_case SEM prefixo do schema
--   • PK sempre `id uuid default gen_random_uuid()`
--   • toda tabela: created_at, created_by, updated_at, updated_by, deleted_at
--   • RLS FORCE em todos os schemas operacionais
--   • audit.* é append-only (deny update + deny delete)

-- ─────────────────────────── SCHEMAS ───────────────────────────────────────

-- Operacionais (bounded contexts)
create schema if not exists pcm;           -- PCM: ordens de serviço, backlog, inspeções
create schema if not exists atendimento;   -- Atendimento: Agente Zé, fila WhatsApp
create schema if not exists comercial;     -- Comercial: CRM, propostas, contratos
create schema if not exists financeiro;    -- Financeiro: faturamento, custos, recebíveis
create schema if not exists estoque;       -- Operação & Estoque: materiais, consumo
create schema if not exists marketing;     -- Marketing: calendário, conteúdo
create schema if not exists growth;        -- Growth: leads, campanhas, ROAS

-- Transversais
create schema if not exists audit;         -- Eventos auditáveis — append-only
create schema if not exists lgpd;          -- Consentimentos, export, delete
create schema if not exists config;        -- Feature flags, thresholds por condomínio

-- ─────────────────────────── AUDIT (append-only) ───────────────────────────

create table if not exists audit.events (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid,
  action      text        not null,
  entity      text        not null,
  entity_id   uuid,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

alter table audit.events enable row level security;
alter table audit.events force row level security;

-- Ninguém pode alterar ou apagar eventos de auditoria, nem service_role.
create policy "audit: deny update" on audit.events for update using (false);
create policy "audit: deny delete" on audit.events for delete using (false);

-- ─────────────────────────── PCM ───────────────────────────────────────────

create table if not exists pcm.clientes (
  id           uuid        primary key default gen_random_uuid(),
  nome         text        not null,
  cnpj         text        unique,
  auvo_id      bigint      unique,
  ativo        boolean     not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid        not null references auth.users,
  updated_at   timestamptz,
  updated_by   uuid        references auth.users,
  deleted_at   timestamptz
);

create table if not exists pcm.ordens_servico (
  id               uuid        primary key default gen_random_uuid(),
  client_id        uuid        not null references pcm.clientes,
  numero           text        not null unique,     -- CH-001, CH-002 …
  titulo           text        not null,
  descricao        text,
  categoria        text        not null,            -- corretiva | preventiva | emergencial
  status           text        not null default 'solicitacao',
  prioridade       text        not null default 'normal',
  -- GUT: calculado SEMPRE no banco (GENERATED); salvo para performance
  gravidade        int         check (gravidade between 1 and 5),
  urgencia         int         check (urgencia between 1 and 5),
  tendencia        int         check (tendencia between 1 and 5),
  score_pcm        int         generated always as (
                                 coalesce(gravidade, 1) * coalesce(urgencia, 1) * coalesce(tendencia, 1)
                               ) stored,
  local_descricao  text,
  solicitante      text,
  origem           text        not null default 'manual', -- manual | ze | portal
  origem_ref_id    text,                                   -- chat_id do Zé, ou forma_id
  auvo_task_id     bigint      unique,
  auvo_sync_status text,
  auvo_synced_at   timestamptz,
  auvo_sync_error  text,
  created_at       timestamptz not null default now(),
  created_by       uuid        not null references auth.users,
  updated_at       timestamptz,
  updated_by       uuid        references auth.users,
  deleted_at       timestamptz
);

create index if not exists idx_os_client      on pcm.ordens_servico (client_id);
create index if not exists idx_os_status      on pcm.ordens_servico (status);
create index if not exists idx_os_score_desc  on pcm.ordens_servico (score_pcm desc);
create index if not exists idx_os_origem      on pcm.ordens_servico (origem);
create index if not exists idx_os_auvo_task   on pcm.ordens_servico (auvo_task_id);

alter table pcm.clientes         enable row level security;
alter table pcm.clientes         force row level security;
alter table pcm.ordens_servico   enable row level security;
alter table pcm.ordens_servico   force row level security;

-- ─────────────────────────── ATENDIMENTO ───────────────────────────────────

create table if not exists atendimento.config_ze (
  id           uuid        primary key default gen_random_uuid(),
  client_id    uuid        not null references pcm.clientes unique,
  modo         text        not null default 'monitor', -- off | monitor | active
  group_jid    text,
  bot_jid      text,
  created_at   timestamptz not null default now(),
  created_by   uuid        not null references auth.users,
  updated_at   timestamptz,
  updated_by   uuid        references auth.users
);

create table if not exists atendimento.wa_messages (
  id           uuid        primary key default gen_random_uuid(),
  instance_id  text        not null,
  remote_jid   text        not null,
  sender_jid   text,
  message_id   text        not null unique,            -- ID interno do WhatsApp
  content      text,
  received_at  timestamptz not null default now(),
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists atendimento.wa_queue (
  id           uuid        primary key default gen_random_uuid(),
  queue_key    text        not null,                   -- instância + JID do grupo
  wait_until   timestamptz not null,
  status       text        not null default 'pending', -- pending | processing | done | skipped | error
  error_message text,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_wa_queue_status_wait on atendimento.wa_queue (status, wait_until);

alter table atendimento.config_ze    enable row level security;
alter table atendimento.config_ze    force row level security;
alter table atendimento.wa_messages  enable row level security;
alter table atendimento.wa_messages  force row level security;
alter table atendimento.wa_queue     enable row level security;
alter table atendimento.wa_queue     force row level security;

-- ─────────────────────────── COMERCIAL ─────────────────────────────────────

create table if not exists comercial.leads (
  id           uuid        primary key default gen_random_uuid(),
  nome         text        not null,
  email        text,
  telefone     text,
  origem       text,
  status       text        not null default 'novo', -- novo | qualificado | perdido
  created_at   timestamptz not null default now(),
  created_by   uuid        not null references auth.users,
  updated_at   timestamptz,
  updated_by   uuid        references auth.users,
  deleted_at   timestamptz
);

alter table comercial.leads enable row level security;
alter table comercial.leads force row level security;

-- ─────────────────────────── CONFIG ────────────────────────────────────────

create table if not exists config.feature_flags (
  id           uuid        primary key default gen_random_uuid(),
  chave        text        not null unique,
  valor        jsonb       not null default 'false',
  descricao    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

alter table config.feature_flags enable row level security;
alter table config.feature_flags force row level security;
