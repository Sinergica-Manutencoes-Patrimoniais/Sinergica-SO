-- 0134_E01-S88_chamados.sql — Sinérgica SO
-- Story E01-S88. Chamado (CH-XXXX) como entidade própria — registro rastreável de tudo que ainda
-- não é OS (solicitações, itens de inspeção). Semeada das colunas úteis de `pcm.tickets`
-- (título/descrição/cliente/status/auditoria) mas desacoplada do sync Auvo por decisão do PO
-- (design.md D1) — nenhuma coluna de metadata Auvo, nenhum trigger de outbox.

create sequence pcm.seq_chamados_numero;

grant usage on sequence pcm.seq_chamados_numero to authenticated, service_role;

create or replace function pcm.fn_proximo_numero_chamado()
returns text
language sql
as $$
  select 'CH-' || lpad(nextval('pcm.seq_chamados_numero')::text, 4, '0');
$$;

grant execute on function pcm.fn_proximo_numero_chamado() to authenticated, service_role;

create table pcm.chamados (
  id                          uuid        primary key default gen_random_uuid(),
  numero                      text        not null unique,
  cliente_id                  uuid        not null references pcm.clientes (id),
  titulo                      text        not null,
  descricao                   text,
  origem                      text        not null default 'manual'
                                           check (origem in ('manual', 'cliente_portal', 'whatsapp', 'inspecao')),
  status                      text        not null default 'aberto'
                                           check (status in ('aberto', 'convertido_os', 'backlog', 'cancelado')),
  solicitante                 text,
  ordem_servico_id            uuid        references pcm.ordens_servico (id),
  cancelamento_justificativa  text,
  cancelamento_anexo_path     text,
  created_at                  timestamptz not null default now(),
  created_by                  uuid        references auth.users,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid        references auth.users,
  deleted_at                  timestamptz
);

create index idx_chamados_cliente on pcm.chamados (cliente_id);
create index idx_chamados_status on pcm.chamados (status);

alter table pcm.chamados enable row level security;
alter table pcm.chamados force row level security;

grant select, insert, update on pcm.chamados to authenticated;
grant select, insert, update, delete on pcm.chamados to service_role;

create policy "chamados_select" on pcm.chamados for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "chamados_insert" on pcm.chamados for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "chamados_update" on pcm.chamados for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- Eventos append-only (padrão `financeiro.lancamentos_eventos`, 0117) — auditoria de cada mudança
-- de status do Chamado (criado/convertido em OS/enviado ao backlog/cancelado). Sem policy de
-- update/delete — ninguém edita ou apaga evento de auditoria, nem superadmin.
create table pcm.chamados_eventos (
  id          uuid        primary key default gen_random_uuid(),
  chamado_id  uuid        not null references pcm.chamados (id),
  tipo        text        not null check (tipo in ('criado', 'os_gerada', 'enviado_backlog', 'cancelado')),
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users default auth.uid()
);

create index idx_chamados_eventos_chamado on pcm.chamados_eventos (chamado_id, created_at desc);

alter table pcm.chamados_eventos enable row level security;
alter table pcm.chamados_eventos force row level security;

grant select on pcm.chamados_eventos to authenticated;
grant insert on pcm.chamados_eventos to authenticated;
grant select, insert, update, delete on pcm.chamados_eventos to service_role;

create policy "chamados_eventos_select" on pcm.chamados_eventos for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "chamados_eventos_insert" on pcm.chamados_eventos for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- AC-3: rastreio Chamado→OS quando o Chamado gera uma OS (mesmo padrão de `pmoc_schedule_id`,
-- E01-S07/0101: NOT VALID aqui, VALIDATE em migration separada).
alter table pcm.ordens_servico add column if not exists chamado_id uuid;
alter table pcm.ordens_servico
  add constraint ordens_servico_chamado_id_fkey
  foreign key (chamado_id) references pcm.chamados (id) not valid;
create index if not exists idx_os_chamado on pcm.ordens_servico (chamado_id) where chamado_id is not null;
comment on column pcm.ordens_servico.chamado_id is 'E01-S88: Chamado de origem, quando a OS nasceu de um (AC-3). NULL para OS manual/PMOC/Auvo.';

-- AC-4: bucket privado pro anexo de cancelamento (ex.: print de WhatsApp autorizando) — mesmo
-- padrão de `financeiro-comprovantes` (0117).
insert into storage.buckets (id, name, public, file_size_limit)
values ('chamados-anexos', 'chamados-anexos', false, 10485760)
on conflict (id) do nothing;

create policy "chamados_anexos_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'chamados-anexos'
    and (
      auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    )
  );
create policy "chamados_anexos_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chamados-anexos'
    and (
      auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
    )
  );
