-- 0139_E01-S91_clientes_marcacoes_status.sql — Sinérgica SO
-- Story E01-S91. Catálogo gerenciável de marcações de status de cliente (nome+cor) — AC-1.
-- `pcm.clientes.marcacao_id` guarda a marcação vigente, no máximo 1 por cliente (AC-2): é uma
-- coluna simples, não uma tabela de histórico — "trocar substitui a anterior" é só um UPDATE.
--
-- AC-3 (casos de borda) "excluir marcação em uso → bloquear": resolvido pela própria FK (sem
-- `on delete cascade/set null` = `NO ACTION`, Postgres já rejeita o DELETE com 23503) — nenhuma
-- guarda de aplicação extra precisa existir só pra isso.
--
-- Reverso:
--   alter table pcm.clientes drop column if exists marcacao_id;
--   drop table if exists pcm.marcacoes_cliente;

create table if not exists pcm.marcacoes_cliente (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null unique,
  cor         text        not null,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users,
  updated_at  timestamptz,
  updated_by  uuid        references auth.users
);

alter table pcm.marcacoes_cliente enable row level security;
alter table pcm.marcacoes_cliente force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update, delete on pcm.marcacoes_cliente to authenticated;
grant select, insert, update, delete on pcm.marcacoes_cliente to service_role;

create policy "marcacoes_cliente_select" on pcm.marcacoes_cliente
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "marcacoes_cliente_insert" on pcm.marcacoes_cliente
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "marcacoes_cliente_update" on pcm.marcacoes_cliente
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "marcacoes_cliente_delete" on pcm.marcacoes_cliente
  for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

insert into pcm.marcacoes_cliente (nome, cor)
values
  ('Inativo', '#6B7280'),
  ('Ativo com contrato', '#16A34A'),
  ('Lead', '#2563EB')
on conflict (nome) do nothing;

-- Squawk: FK direto na ALTER ADD COLUMN faz scan+lock na tabela com dado de produção — NOT VALID
-- aqui, VALIDATE em migration separada (mesmo padrão de 0128/0129, 0134/0135, 0137/0138).
alter table pcm.clientes add column if not exists marcacao_id uuid;
alter table pcm.clientes add constraint clientes_marcacao_id_fkey
  foreign key (marcacao_id) references pcm.marcacoes_cliente (id) not valid;
