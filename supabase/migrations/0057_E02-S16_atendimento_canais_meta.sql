-- 0057_E02-S16_atendimento_canais_meta.sql — Sinérgica SO
-- Config de canais Meta (E02-S16): Meta WA + Instagram + Messenger compartilham a MESMA forma
-- (label, identificador externo, verify_token, status de conexão) — uma tabela com `tipo`
-- discriminador em vez de 3 tabelas quase idênticas. Templates de WhatsApp ficam à parte (é outro
-- conceito: mensagem pré-aprovada, não canal). Segredos (token de acesso) NUNCA vão pra cá — ficam
-- em Vault/Edge secret, referenciados por nome, nunca o valor em si (AC-1, "segredos fora do client").
--
-- Reverso:
--   drop table if exists atendimento.wa_templates;
--   drop table if exists atendimento.canais_externos;

create table if not exists atendimento.canais_externos (
  id                    uuid        primary key default gen_random_uuid(),
  tipo                  text        not null check (tipo in ('meta_wa', 'instagram', 'messenger')),
  label                 text        not null,
  identificador_externo text,       -- phone_number_id (meta_wa) / ig_user_id (instagram) / page_id (messenger)
  verify_token          text,
  secret_ref            text,       -- nome do secret no Vault/Edge — NUNCA o valor
  webhook_registrado    boolean     not null default false,
  status_conexao        text        not null default 'desconectado' check (status_conexao in ('conectado', 'desconectado', 'erro')),
  ativo                 boolean     not null default true,
  created_at            timestamptz not null default now(),
  created_by            uuid        references auth.users,
  updated_at            timestamptz,
  updated_by            uuid        references auth.users
);

create index if not exists idx_canais_externos_tipo_ativo
  on atendimento.canais_externos (tipo, ativo);

create table if not exists atendimento.wa_templates (
  id           uuid        primary key default gen_random_uuid(),
  canal_id     uuid        not null references atendimento.canais_externos(id),
  nome         text        not null,
  idioma       text        not null default 'pt_BR',
  categoria    text        not null check (categoria in ('utility', 'marketing', 'authentication')),
  status       text        not null default 'pending' check (status in ('approved', 'pending', 'rejected')),
  corpo        text        not null,
  ativo        boolean     not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users
);

create index if not exists idx_wa_templates_canal
  on atendimento.wa_templates (canal_id, ativo);

alter table atendimento.canais_externos enable row level security;
alter table atendimento.canais_externos force row level security;
alter table atendimento.wa_templates     enable row level security;
alter table atendimento.wa_templates     force row level security;

grant select, insert, update on atendimento.canais_externos, atendimento.wa_templates to authenticated;
grant select, insert, update, delete on atendimento.canais_externos, atendimento.wa_templates to service_role;

create policy "canais_externos_select" on atendimento.canais_externos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "canais_externos_insert" on atendimento.canais_externos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "canais_externos_update" on atendimento.canais_externos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "wa_templates_select" on atendimento.wa_templates
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "wa_templates_insert" on atendimento.wa_templates
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "wa_templates_update" on atendimento.wa_templates
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );
