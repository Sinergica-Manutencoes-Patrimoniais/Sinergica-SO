-- 0159_E02-S24_memoria_alma_cliente.sql — Sinérgica SO
-- Story E02-S24. Memória e "alma" por cliente pro Zé — prompt base único (persona 'chamados'
-- continua compartilhada) consumindo alma+resumo por cliente como contexto. Decisão (ADR-0015,
-- ver docs/adr/): estratégia textual simples no MVP, sem RAG/embeddings.
--
-- `cliente_alma`: texto livre editável (síndico "é grosso", "prefere áudio", etc.) — 1 registro
-- por cliente, isolado por cliente_id (AC-4, isolamento é requisito de segurança).
-- `cliente_memoria_resumo`: resumo rolante das conversas antigas (2-3 meses) — 1 registro por
-- cliente, sobrescrito a cada geração (não é histórico de resumos, é o resumo vigente).
--
-- Reverso:
--   drop table if exists atendimento.cliente_alma;
--   drop table if exists atendimento.cliente_memoria_resumo;

create table atendimento.cliente_alma (
  cliente_id  uuid        primary key references pcm.clientes (id),
  conteudo    text        not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users
);

create table atendimento.cliente_memoria_resumo (
  cliente_id      uuid        primary key references pcm.clientes (id),
  resumo          text        not null default '',
  periodo_inicio  timestamptz,
  periodo_fim     timestamptz,
  updated_at      timestamptz not null default now()
);

alter table atendimento.cliente_alma enable row level security;
alter table atendimento.cliente_alma force row level security;
alter table atendimento.cliente_memoria_resumo enable row level security;
alter table atendimento.cliente_memoria_resumo force row level security;

grant select, insert, update on atendimento.cliente_alma to authenticated;
grant select, insert, update, delete on atendimento.cliente_alma to service_role;
grant select on atendimento.cliente_memoria_resumo to authenticated;
grant select, insert, update, delete on atendimento.cliente_memoria_resumo to service_role;

create policy "cliente_alma_select" on atendimento.cliente_alma for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "cliente_alma_insert" on atendimento.cliente_alma for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );
create policy "cliente_alma_update" on atendimento.cliente_alma for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- `cliente_memoria_resumo` é gerado por job/edge function (service_role) — leitura autenticada
-- pra eventual exibição na UI, sem escrita direta do usuário (evita divergir do que a IA resumiu).
create policy "cliente_memoria_resumo_select" on atendimento.cliente_memoria_resumo for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
