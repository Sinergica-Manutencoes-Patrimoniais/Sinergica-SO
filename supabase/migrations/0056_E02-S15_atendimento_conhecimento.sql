-- 0056_E02-S15_atendimento_conhecimento.sql — Sinérgica SO
-- Aba "Conhecimento" (E02-S15). Promove o campo livre `personas.base_conhecimento` a uma base
-- real de entradas, recuperadas por RELEVÂNCIA (AC-2) — usamos busca full-text nativa do Postgres
-- (`tsvector`/`ts_rank`), não embedding vetorial: é relevância de verdade (não prioridade fixa),
-- sem depender de uma API externa de embeddings que este ambiente não pode configurar/verificar
-- (mesmo princípio de não fabricar integração externa sem credenciais, ver E01-S36). Se no futuro
-- a qualidade de FTS não bastar, trocar por pgvector é aditivo (nova coluna embedding + índice).
--
-- Reverso:
--   drop function if exists atendimento.fn_buscar_conhecimento_relevante(uuid, text, int);
--   drop table if exists atendimento.conhecimento_entradas;

create table if not exists atendimento.conhecimento_entradas (
  id           uuid        primary key default gen_random_uuid(),
  persona_id   uuid        references atendimento.personas(id),
  titulo       text        not null,
  conteudo     text        not null,
  categoria    text        not null default 'geral',
  tags         text[]      not null default '{}',
  prioridade   int         not null default 5 check (prioridade between 1 and 10),
  ativo        boolean     not null default true,
  busca        tsvector    generated always as (
                  to_tsvector('portuguese', titulo || ' ' || conteudo)
                ) stored,
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users,
  updated_at   timestamptz,
  updated_by   uuid        references auth.users
);

create index if not exists idx_conhecimento_entradas_busca
  on atendimento.conhecimento_entradas using gin (busca);
create index if not exists idx_conhecimento_entradas_persona_ativo
  on atendimento.conhecimento_entradas (persona_id, ativo);

alter table atendimento.conhecimento_entradas enable row level security;
alter table atendimento.conhecimento_entradas force row level security;

grant select, insert, update on atendimento.conhecimento_entradas to authenticated;
grant select, insert, update, delete on atendimento.conhecimento_entradas to service_role;

create policy "conhecimento_entradas_select" on atendimento.conhecimento_entradas
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "conhecimento_entradas_insert" on atendimento.conhecimento_entradas
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "conhecimento_entradas_update" on atendimento.conhecimento_entradas
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

-- Recuperação por relevância (AC-2) — usada pelo agente (fora do escopo desta migration ligar o
-- Zé nisso) e testável isoladamente via RPC. `security invoker`: mesma regra de 0052, RLS decide.
create or replace function atendimento.fn_buscar_conhecimento_relevante(
  p_persona_id uuid,
  p_pergunta text,
  p_limit int default 5
) returns setof atendimento.conhecimento_entradas
language sql
stable
set search_path = atendimento, public
as $$
  select *
  from atendimento.conhecimento_entradas
  where ativo = true
    and (persona_id = p_persona_id or persona_id is null)
    and busca @@ websearch_to_tsquery('portuguese', p_pergunta)
  order by ts_rank(busca, websearch_to_tsquery('portuguese', p_pergunta)) desc
  limit p_limit;
$$;

revoke all on function atendimento.fn_buscar_conhecimento_relevante(uuid, text, int) from public;
grant execute on function atendimento.fn_buscar_conhecimento_relevante(uuid, text, int) to authenticated, service_role;
