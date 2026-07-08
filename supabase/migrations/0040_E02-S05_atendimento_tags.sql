-- 0040_E02-S05_atendimento_tags.sql — Sinérgica SO
-- Catálogo de tags de conversa do módulo Atendimento (E02-S05). Sem cor/entidade rica — só
-- `nome`+`ativo`, mesmo padrão de `pcm.segmentos`/`pcm.palavras_chave` (E01-S25). Sem FK a
-- `atendimento.conversas.tags` (continua `text[]` de nomes, sem join, mesmo motivo de
-- `pcm.cliente_grupos.clientes_auvo_ids` em E01-S27) — desativar uma tag não apaga o histórico de
-- conversas que já a usam (AC-3), só some da lista de seleção para novas atribuições.
--
-- Reverso:
--   drop table if exists atendimento.tags;

create table if not exists atendimento.tags (
  id         uuid        primary key default gen_random_uuid(),
  nome       text        not null,
  ativo      boolean     not null default true,
  created_at timestamptz not null default now(),
  created_by uuid        references auth.users,
  updated_at timestamptz,
  updated_by uuid        references auth.users
);

create unique index if not exists idx_atendimento_tags_nome_ci
  on atendimento.tags (lower(nome));

alter table atendimento.tags enable row level security;
alter table atendimento.tags force row level security;

grant usage on schema atendimento to authenticated, service_role;
grant select, insert, update on atendimento.tags to authenticated;
grant select, insert, update, delete on atendimento.tags to service_role;

create policy "atendimento_tags_select" on atendimento.tags
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "atendimento_tags_insert" on atendimento.tags
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "atendimento_tags_update" on atendimento.tags
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );
