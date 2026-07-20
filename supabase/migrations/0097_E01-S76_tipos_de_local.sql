-- 0097_E01-S76_tipos_de_local.sql — Sinérgica SO
-- SPEC_DEVIATION: design.md original (0095) modelou `pcm.locais.tipo` como texto livre nullable.
-- Feedback do PO (Lucas, 2026-07-18) durante a implementação: cadastro em texto livre repete o
-- problema de divergência de escrita que a própria story existe para resolver (ex.: "Andar" vs
-- "andar" vs "3o andar" pro mesmo conceito). Decisão: cada cliente cadastra seu próprio catálogo
-- de Tipos de Local (`pcm.local_tipos`) na aba Estrutura; a atribuição no Local vira seleção
-- (`tipo_id`), nunca digitação. Coluna legada `tipo` (texto) fica na tabela só como histórico —
-- convenção da casa é nunca fazer DROP COLUMN numa migration "pra frente" (ver Reverso de
-- 0006/0022/0030/0043/0047 — sempre documentado, nunca executado); código para de ler/escrever
-- nela. FK nova entra NOT VALID, VALIDATE na migration seguinte (0098) — padrão 0070/0071/0095/0096.
--
-- Reverso:
--   alter table pcm.locais drop constraint if exists fk_locais_tipo_id;
--   alter table pcm.locais drop column if exists tipo_id;
--   drop table if exists pcm.local_tipos;

create table if not exists pcm.local_tipos (
  id          uuid        primary key default gen_random_uuid(),
  cliente_id  uuid        not null references pcm.clientes (id),
  nome        text        not null,
  ordem       int         not null default 0,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users,
  deleted_at  timestamptz
);
create unique index if not exists uq_local_tipos_cliente_nome
  on pcm.local_tipos (cliente_id, lower(nome)) where deleted_at is null;
create index if not exists idx_local_tipos_cliente
  on pcm.local_tipos (cliente_id) where deleted_at is null;

alter table pcm.local_tipos enable row level security;
alter table pcm.local_tipos force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on pcm.local_tipos to authenticated;
grant select, insert, update, delete on pcm.local_tipos to service_role;

create policy "local_tipos_select" on pcm.local_tipos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "local_tipos_insert" on pcm.local_tipos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "local_tipos_update" on pcm.local_tipos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- pcm.locais: `tipo_id` (seleção do catálogo do cliente) substitui `tipo` (texto livre) no
-- domínio/aplicação/UI — coluna `tipo` fica só como histórico, não lida nem escrita pelo código.
alter table pcm.locais add column if not exists tipo_id uuid;
alter table pcm.locais
  add constraint fk_locais_tipo_id foreign key (tipo_id) references pcm.local_tipos (id) not valid;
create index if not exists idx_locais_tipo on pcm.locais (tipo_id) where deleted_at is null;
