-- 0182_E03-S04_propostas.sql — Sinérgica SO
-- Story E03-S04. Editor de proposta: propostas, composição por itens, e o histórico
-- append-only de versões (design.md §2.3).
--
-- `proposta_versoes` NUNCA aceita UPDATE/DELETE — nem superadmin (mesmo padrão de
-- `financeiro.lancamentos_eventos`, E04-S07). É o que garante que a peça que o cliente recebeu
-- não muda retroativamente (AC-7).
--
-- Rollback:
--   drop table if exists comercial.proposta_versoes;
--   drop table if exists comercial.proposta_itens;
--   drop table if exists comercial.propostas;

create table comercial.propostas (
  id                    uuid        primary key default gen_random_uuid(),
  oportunidade_id       uuid        not null references comercial.oportunidades (id),
  tipo                  text        not null
                                     check (tipo in ('levantamento', 'volante', 'residente', 'simples')),
  status                text        not null default 'rascunho'
                                     check (status in
                                       ('rascunho', 'em_revisao', 'aprovada', 'enviada',
                                        'aceita', 'recusada', 'cancelada')),
  -- FK real para pcm.inspecoes (o Assessment) — só a chave, pra integridade referencial; a
  -- LEITURA dos dados do Assessment é por RPC do PCM (S05), nunca select direto (ADR-0019 R2).
  assessment_id         uuid        references pcm.inspecoes (id),
  escopo                text,
  observacoes           text,
  custo_total_centavos    bigint      not null default 0 check (custo_total_centavos >= 0),
  piso_centavos           bigint      not null default 0 check (piso_centavos >= 0),
  -- Preço que o motor de preço (E03-S03) sugeriu a partir de custo/margem/alíquota — referência
  -- fixa para calcular o desconto real dado. `preco_centavos` é o que a proposta vai cobrar de
  -- fato (editável entre piso e preço sugerido; força abaixo do piso é a exceção do AC-4).
  preco_sugerido_centavos bigint      not null default 0 check (preco_sugerido_centavos >= 0),
  preco_centavos          bigint      not null default 0 check (preco_centavos >= 0),
  -- Desconto real dado em relação ao preço sugerido — não ao piso. Faixa ampla (não só >= 0)
  -- porque a exceção de força (AC-4) pode empurrar o preço abaixo do piso, o que dá desconto
  -- MAIOR que 100% do intervalo sugerido↔piso; nunca deve passar de 100% em uso normal.
  desconto_pct            numeric(6, 3) not null default 0 check (desconto_pct between -100 and 200),
  valido_ate            date,
  versao_atual          int         not null default 1 check (versao_atual >= 1),
  created_at            timestamptz not null default now(),
  created_by            uuid        references auth.users,
  updated_at            timestamptz not null default now(),
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

create index idx_propostas_oportunidade on comercial.propostas (oportunidade_id);
create index idx_propostas_status on comercial.propostas (status);

-- AC-4: preço abaixo do piso é rejeitado NO BANCO — por TRIGGER, não CHECK constraint.
-- Postgres não permite CHECK adiável (só UNIQUE/PK/FK/EXCLUDE são DEFERRABLE); o bypass do
-- superadmin usa uma flag de transação (`set_config`, local à transação) que só a RPC
-- `fn_forcar_preco_abaixo_piso` (migration 0183) liga — UPDATE/INSERT direto na tabela, mesmo por
-- superadmin, nunca passa pelo trigger com a flag ligada.

create table comercial.proposta_itens (
  id                      uuid        primary key default gen_random_uuid(),
  proposta_id             uuid        not null references comercial.propostas (id) on delete cascade,
  tipo                    text        not null check (tipo in ('mo', 'material', 'veiculo', 'outro')),
  descricao               text        not null,
  nivel_id                uuid        references comercial.niveis_tecnico (id),
  material_id             uuid        references comercial.materiais (id),
  quantidade              numeric(10, 2) not null check (quantidade >= 0),
  custo_unitario_centavos bigint      not null check (custo_unitario_centavos >= 0),
  total_centavos          bigint      not null check (total_centavos >= 0),
  created_at              timestamptz not null default now(),
  created_by              uuid        references auth.users,
  updated_at              timestamptz not null default now(),
  updated_by              uuid        references auth.users
);

create index idx_proposta_itens_proposta on comercial.proposta_itens (proposta_id);

create table comercial.proposta_versoes (
  id           uuid        primary key default gen_random_uuid(),
  proposta_id  uuid        not null references comercial.propostas (id) on delete cascade,
  versao       int         not null check (versao >= 1),
  payload      jsonb       not null,
  criado_em    timestamptz not null default now(),
  criado_por   uuid        references auth.users,
  unique (proposta_id, versao)
);

create index idx_proposta_versoes_proposta on comercial.proposta_versoes (proposta_id, versao desc);

-- Evento de força de piso (AC-4) — mesma ideia append-only, guarda quem autorizou e por quê.
create table comercial.proposta_forcos_piso (
  id                uuid        primary key default gen_random_uuid(),
  proposta_id       uuid        not null references comercial.propostas (id) on delete cascade,
  preco_centavos    bigint      not null,
  piso_centavos     bigint      not null,
  autorizado_por    uuid        not null references auth.users,
  autorizado_em     timestamptz not null default now(),
  motivo            text
);

-- ─────────────────────────── RLS ────────────────────────────────────────────

alter table comercial.propostas             enable row level security;
alter table comercial.propostas             force  row level security;
alter table comercial.proposta_itens        enable row level security;
alter table comercial.proposta_itens        force  row level security;
alter table comercial.proposta_versoes      enable row level security;
alter table comercial.proposta_versoes      force  row level security;
alter table comercial.proposta_forcos_piso  enable row level security;
alter table comercial.proposta_forcos_piso  force  row level security;

grant select, insert, update, delete on comercial.propostas      to authenticated;
grant select, insert, update, delete on comercial.proposta_itens to authenticated;
-- Versões: só INSERT e SELECT — append-only pra todo mundo, inclusive superadmin (AC-7 real).
grant select, insert                 on comercial.proposta_versoes to authenticated;
-- Só SELECT pra `authenticated`: gravar é exclusivo da RPC fn_forcar_preco_abaixo_piso (security
-- definer, migration 0183) — sem policy de insert e sem grant de insert direto, um `authenticated`
-- não grava aqui nem que tente.
grant select                         on comercial.proposta_forcos_piso to authenticated;

grant select, insert, update, delete on comercial.propostas            to service_role;
grant select, insert, update, delete on comercial.proposta_itens       to service_role;
grant select, insert                 on comercial.proposta_versoes     to service_role;
grant select, insert                 on comercial.proposta_forcos_piso to service_role;

create policy "propostas_select" on comercial.propostas for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "propostas_escrita" on comercial.propostas for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

create policy "proposta_itens_select" on comercial.proposta_itens for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "proposta_itens_escrita" on comercial.proposta_itens for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

create policy "proposta_versoes_select" on comercial.proposta_versoes for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "proposta_versoes_insert" on comercial.proposta_versoes for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

create policy "proposta_forcos_piso_select" on comercial.proposta_forcos_piso
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
-- Insert só via RPC fn_forcar_preco_abaixo_piso (security definer) — sem policy de insert direto
-- pra `authenticated`, então só service_role (que a RPC usa internamente via security definer)
-- consegue gravar. A tabela em si não expõe insert avulso.

comment on table comercial.propostas is
  'E03-S04. Status seguem docs/blueprint/03-comercial.md — não inventar nomes novos.';
comment on table comercial.proposta_versoes is
  'Append-only via RLS: nenhuma policy de UPDATE/DELETE pra `authenticated`, nem para o papel '
  'superadmin dentro do JWT (AC-7 — a peça enviada nunca muda). Vale para tudo que passa pelo '
  'PostgREST/app; conexão direta como superuser do Postgres sempre ignora RLS, como em qualquer '
  'tabela do banco — não é uma garantia específica desta tabela, é limite do próprio Postgres.';
