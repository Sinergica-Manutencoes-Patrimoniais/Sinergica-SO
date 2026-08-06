-- 0167_E01-S135_relatorios_cliente_publicados.sql — Sinérgica SO
-- Retrato imutável de um relatório publicado: o Portal não reconsulta a operação ao abrir uma
-- versão antiga. O isolamento é sempre pelo cliente do claim, inclusive com table owner sob FORCE.

create table pcm.relatorios_cliente_publicados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references pcm.clientes (id),
  titulo text not null check (nullif(btrim(titulo), '') is not null),
  periodo_inicio date not null,
  periodo_fim date not null,
  conteudo jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users,
  check (periodo_fim >= periodo_inicio),
  check (jsonb_typeof(conteudo) = 'object')
);

create index idx_relatorios_cliente_publicados_cliente_created
  on pcm.relatorios_cliente_publicados (cliente_id, created_at desc);

alter table pcm.relatorios_cliente_publicados enable row level security;
alter table pcm.relatorios_cliente_publicados force row level security;

grant select, insert on pcm.relatorios_cliente_publicados to authenticated;
grant select, insert, update, delete on pcm.relatorios_cliente_publicados to service_role;

create policy "relatorios_cliente_publicados_select" on pcm.relatorios_cliente_publicados
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (
      auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
    )
  );

create policy "relatorios_cliente_publicados_insert" on pcm.relatorios_cliente_publicados
  for insert to authenticated
  with check (
    (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
    and created_by = auth.uid()
  );

comment on table pcm.relatorios_cliente_publicados is
  'Versões imutáveis do relatório de apresentação do cliente (E01-S135).';
