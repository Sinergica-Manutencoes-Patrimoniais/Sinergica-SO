-- 0173_E03-S01_fundacao_comercial.sql — Sinérgica SO
-- Story E03-S01. Fundação do módulo Comercial: o funil como ENRIQUECIMENTO da Conta.
--
-- `pcm.clientes` é a Conta (identidade) e é Shared Kernel — 35 FKs de 4 contextos (ADR-0019).
-- O funil (etapa, score, origem, motivo de perda) é dado do Comercial e mora aqui, com FK
-- `cliente_id`; NUNCA como coluna nova em `pcm.clientes` (regra R3 do ADR-0019). É por isso que
-- `pcm.clientes.tipo`/`status_comercial` são depreciadas em 0175 em vez de ganharem companhia.
--
-- Conta única (ADR-0020): lead, prospecto, cliente ativo e cliente antigo são a MESMA linha em
-- `pcm.clientes`, do primeiro contato ao encerramento. Uma Conta pode ter várias oportunidades ao
-- longo do tempo. O PCM filtra `ativo`; o Comercial não filtra nada.
--
-- `comercial.leads` NÃO é tocada aqui: está vazia mas viva — `pcm-ze-agent` está deployada em
-- produção e insere nela. O drop é a E03-S10, depois que a E03-S09 fizer o agente escrever em
-- `comercial.oportunidades` (design.md §4.3).
--
-- Rollback:
--   drop table if exists comercial.oportunidade_eventos;
--   drop table if exists comercial.oportunidades;
--   drop table if exists comercial.motivos_perda;
--   drop table if exists comercial.etapas_funil;

grant usage on schema comercial to authenticated, service_role;

-- ─────────────────────────── ETAPAS DO FUNIL ────────────────────────────────
-- Configuráveis (decisão 7 do PO, mesmo padrão do Kanban de OS da E01-S84). `tipo` existe para as
-- métricas não quebrarem quando alguém renomear uma coluna: o dashboard (E03-S08) agrega por
-- `tipo`, nunca por `nome`.

create table comercial.etapas_funil (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null unique,
  ordem       int         not null,
  cor         text        not null,
  tipo        text        not null default 'aberta'
                           check (tipo in ('aberta', 'ganha', 'perdida')),
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users
);

create index idx_etapas_funil_ordem on comercial.etapas_funil (ordem) where ativo;

-- ─────────────────────────── MOTIVOS DE PERDA ───────────────────────────────

create table comercial.motivos_perda (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null unique,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users
);

-- ─────────────────────────── OPORTUNIDADES ──────────────────────────────────
-- `score`, `resumo`, `origem`, `origem_ref`, `lead_tier`, `cluster_nome`, `conversa_id` e
-- `contato_id` espelham as colunas de `comercial.leads` (18 no total, verificadas em produção) —
-- a E03-S09 vai migrar o agente para cá sem perder nenhum campo.

create table comercial.oportunidades (
  id                      uuid        primary key default gen_random_uuid(),
  cliente_id              uuid        not null references pcm.clientes (id),
  etapa_id                uuid        not null references comercial.etapas_funil (id),
  titulo                  text        not null,
  descricao               text,
  valor_estimado_centavos bigint      check (valor_estimado_centavos >= 0),
  score                   int         check (score between 0 and 100),
  resumo                  text,
  origem                  text,
  origem_ref              text,
  lead_tier               text        check (lead_tier in ('A', 'B', 'C', 'D')),
  cluster_nome            text,
  conversa_id             uuid        references atendimento.conversas (id),
  contato_id              uuid        references relacionamento.contatos (id),
  responsavel_id          uuid        references auth.users,
  motivo_perda_id         uuid        references comercial.motivos_perda (id),
  fechada_em              timestamptz,
  created_at              timestamptz not null default now(),
  created_by              uuid        references auth.users,
  updated_at              timestamptz not null default now(),
  updated_by              uuid        references auth.users,
  deleted_at              timestamptz
);

create index idx_oportunidades_cliente on comercial.oportunidades (cliente_id);
create index idx_oportunidades_etapa on comercial.oportunidades (etapa_id);
create index idx_oportunidades_conversa on comercial.oportunidades (conversa_id)
  where conversa_id is not null;

-- ─────────────────────────── EVENTOS (append-only) ──────────────────────────
-- A fonte do ciclo de venda (E03-S08). A UI nunca calcula tempo de etapa por diferença de datas
-- da oportunidade — lê daqui. Append-only: sem grant de update/delete para `authenticated`, mesmo
-- padrão de `financeiro.lancamentos_eventos` (0117) e `pcm.chamados_eventos` (0134).

create table comercial.oportunidade_eventos (
  id              uuid        primary key default gen_random_uuid(),
  oportunidade_id uuid        not null references comercial.oportunidades (id) on delete cascade,
  etapa_de        uuid        references comercial.etapas_funil (id),
  etapa_para      uuid        not null references comercial.etapas_funil (id),
  ocorrido_em     timestamptz not null default now(),
  ator_id         uuid        references auth.users
);

create index idx_oportunidade_eventos_oportunidade
  on comercial.oportunidade_eventos (oportunidade_id, ocorrido_em desc);

-- ─────────────────────────── RLS ────────────────────────────────────────────

alter table comercial.etapas_funil          enable row level security;
alter table comercial.etapas_funil          force  row level security;
alter table comercial.motivos_perda         enable row level security;
alter table comercial.motivos_perda         force  row level security;
alter table comercial.oportunidades         enable row level security;
alter table comercial.oportunidades         force  row level security;
alter table comercial.oportunidade_eventos  enable row level security;
alter table comercial.oportunidade_eventos  force  row level security;

grant select, insert, update, delete on comercial.etapas_funil  to authenticated;
grant select, insert, update, delete on comercial.motivos_perda to authenticated;
grant select, insert, update, delete on comercial.oportunidades to authenticated;
-- Eventos: só INSERT e SELECT (append-only) — nem superadmin reescreve histórico de funil.
grant select, insert                 on comercial.oportunidade_eventos to authenticated;

grant select, insert, update, delete on comercial.etapas_funil         to service_role;
grant select, insert, update, delete on comercial.motivos_perda        to service_role;
grant select, insert, update, delete on comercial.oportunidades        to service_role;
grant select, insert                 on comercial.oportunidade_eventos to service_role;

create policy "etapas_funil_select" on comercial.etapas_funil for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "etapas_funil_escrita" on comercial.etapas_funil for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

create policy "motivos_perda_select" on comercial.motivos_perda for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "motivos_perda_escrita" on comercial.motivos_perda for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

create policy "oportunidades_select" on comercial.oportunidades for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "oportunidades_escrita" on comercial.oportunidades for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

create policy "oportunidade_eventos_select" on comercial.oportunidade_eventos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "oportunidade_eventos_insert" on comercial.oportunidade_eventos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

-- ─────────────────────────── SEED ───────────────────────────────────────────
-- Funil do `docs/blueprint/03-comercial.md`. Editável na UI (E03-S02) — este é o ponto de partida,
-- não uma regra.

insert into comercial.etapas_funil (nome, ordem, cor, tipo)
values
  ('Lead',             1, '#2563EB', 'aberta'),
  ('Qualificado',      2, '#7C3AED', 'aberta'),
  ('Proposta enviada', 3, '#D97706', 'aberta'),
  ('Negociação',       4, '#0891B2', 'aberta'),
  ('Ganho',            5, '#16A34A', 'ganha'),
  ('Perdido',          6, '#DC2626', 'perdida')
on conflict (nome) do nothing;

insert into comercial.motivos_perda (nome)
values
  ('Preço acima do orçamento do cliente'),
  ('Fechou com concorrente'),
  ('Sem resposta / contato perdido'),
  ('Fora do escopo de atuação'),
  ('Momento inadequado — retomar depois')
on conflict (nome) do nothing;

comment on table comercial.oportunidades is
  'Funil comercial como enriquecimento da Conta (pcm.clientes). ADR-0019 R3, ADR-0020.';
comment on table comercial.oportunidade_eventos is
  'Append-only. Fonte do ciclo de venda e da conversão por etapa (E03-S08).';
comment on column comercial.etapas_funil.tipo is
  'aberta|ganha|perdida — as métricas agregam por tipo, nunca por nome (que é editável).';
