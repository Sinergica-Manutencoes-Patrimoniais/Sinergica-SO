-- 0012_E01-S11_cache_tecnicos_equipamentos.sql — Sinérgica SO
-- Story E01-S11. Cache local read-only de técnicos/equipes e equipamentos do Auvo (Auvo → PCM).
-- A fonte da verdade desses dados é SEMPRE o Auvo; o PCM só espelha via API para exibir nomes/
-- times reais na UI sem chamar o Auvo a cada render. Ver
-- specs/E01-S11-integracao-auvo-sync-tecnicos-equipamentos/spec.md (AC-1 a AC-4).
--
-- Escrita EXCLUSIVA das Edge Functions de sync (`pcm-auvo-users-sync`/`pcm-auvo-equipment-sync`)
-- via `service_role` (bypassa RLS). `authenticated` só LÊ — nenhum código de app do PCM escreve
-- nessas tabelas (AC-3). Defesa em profundidade: policies explícitas de deny INSERT/UPDATE/DELETE
-- para `authenticated` (mesmo padrão de audit.events, 0001) + só GRANT SELECT para `authenticated`.
--
-- CRÍTICO (grant de schema para service_role): o schema `pcm` nunca recebeu `grant usage` para
-- `service_role` — só `authenticated` recebeu (0002). Sem `grant usage on schema pcm to
-- service_role`, a Edge Function de sync levaria "permission denied for schema pcm" ANTES de
-- qualquer RLS/policy (Postgres checa privilégio de schema antes da RLS). É exatamente a classe de
-- bug já corrigida em 0003 (audit.events) e no grant de 0010 — não repetir. Adicionado abaixo.
--
-- Reverso:
--   drop table if exists pcm.equipamentos_cache;
--   drop table if exists pcm.tecnicos_cache;
--   revoke usage on schema pcm from service_role;

-- ─────────────────────────── TÉCNICOS (cache) ──────────────────────────────

create table if not exists pcm.tecnicos_cache (
  id            uuid        primary key default gen_random_uuid(),
  auvo_user_id  bigint      not null,          -- ID do usuário no Auvo (chave de negócio, upsert)
  nome          text        not null,
  equipe        text,                          -- time/equipe no Auvo (opcional)
  ativo         boolean     not null default true,  -- soft delete (AC-4): removido no Auvo → false
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Alvo do upsert por `auvo_user_id` — garante que sync não duplica (AC-1).
create unique index if not exists uq_tecnicos_cache_auvo_user_id
  on pcm.tecnicos_cache (auvo_user_id);

-- ─────────────────────────── EQUIPAMENTOS (cache) ──────────────────────────

create table if not exists pcm.equipamentos_cache (
  id                 uuid        primary key default gen_random_uuid(),
  auvo_equipment_id  bigint      not null,     -- ID do equipamento no Auvo (chave de negócio, upsert)
  nome               text        not null,
  -- FK via `auvo_id` (não `id`): a spec pede vínculo "via auvo_id", e pcm.clientes.auvo_id já é
  -- UNIQUE desde 0001 — Postgres permite FK contra qualquer coluna UNIQUE. Nullable: um equipamento
  -- pode chegar antes do cliente dono estar sincronizado por E01-S09 (sync independente); nesse
  -- caso grava null + log de aviso, sem falhar o sync (ver Edge Function pcm-auvo-equipment-sync).
  auvo_customer_id   bigint      references pcm.clientes (auvo_id),
  ativo              boolean     not null default true,  -- soft delete (AC-4)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists uq_equipamentos_cache_auvo_equipment_id
  on pcm.equipamentos_cache (auvo_equipment_id);

create index if not exists idx_equipamentos_cache_customer
  on pcm.equipamentos_cache (auvo_customer_id);

-- ─────────────────────────── RLS FORCE ─────────────────────────────────────

alter table pcm.tecnicos_cache      enable row level security;
alter table pcm.tecnicos_cache      force  row level security;
alter table pcm.equipamentos_cache  enable row level security;
alter table pcm.equipamentos_cache  force  row level security;

-- ─────────────────────────── GRANT base (pré-requisito da RLS) ─────────────
-- `authenticated`: só SELECT (cache é read-only do ponto de vista do PCM, AC-3).
-- `service_role`: as 4 operações (as Edge Functions de sync gravam) — bypassa RLS mas ainda
-- precisa do privilégio de tabela/schema como qualquer role.
grant usage on schema pcm to service_role;  -- faltava (só authenticated tinha, 0002) — ver topo

grant select on pcm.tecnicos_cache      to authenticated;
grant select on pcm.equipamentos_cache  to authenticated;

grant select, insert, update, delete on pcm.tecnicos_cache      to service_role;
grant select, insert, update, delete on pcm.equipamentos_cache  to service_role;

-- ─────────────────────────── RLS policies ──────────────────────────────────
-- Leitura: mesmo padrão de pcm.clientes (módulo `pcm`, 0009) — superadmin OU quem tem o módulo
-- `pcm` em leitura/escrita no JWT. service_role não aparece nas policies (bypassa RLS).

create policy "tecnicos_cache_select" on pcm.tecnicos_cache
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

-- Deny explícito de escrita para `authenticated` (defesa em profundidade — o GRANT já não dá
-- INSERT/UPDATE/DELETE a authenticated, e sem policy permissiva a RLS já negaria; estas tornam a
-- intenção explícita, mesmo padrão de audit.events em 0001).
create policy "tecnicos_cache_deny_insert" on pcm.tecnicos_cache
  for insert to authenticated with check (false);
create policy "tecnicos_cache_deny_update" on pcm.tecnicos_cache
  for update to authenticated using (false);
create policy "tecnicos_cache_deny_delete" on pcm.tecnicos_cache
  for delete to authenticated using (false);

create policy "equipamentos_cache_select" on pcm.equipamentos_cache
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "equipamentos_cache_deny_insert" on pcm.equipamentos_cache
  for insert to authenticated with check (false);
create policy "equipamentos_cache_deny_update" on pcm.equipamentos_cache
  for update to authenticated using (false);
create policy "equipamentos_cache_deny_delete" on pcm.equipamentos_cache
  for delete to authenticated using (false);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select tablename, policyname, cmd from pg_policies
--  where schemaname = 'pcm' and tablename in ('tecnicos_cache','equipamentos_cache')
--  order by tablename, cmd;
-- select has_schema_privilege('service_role', 'pcm', 'usage');  -- deve ser t
