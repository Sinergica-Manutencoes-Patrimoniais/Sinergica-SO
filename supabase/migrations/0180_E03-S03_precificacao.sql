-- 0180_E03-S03_precificacao.sql — Sinérgica SO
-- Story E03-S03. Motor de precificação: parâmetros, níveis de técnico e catálogo de materiais.
--
-- Story-ilha: tabelas próprias do Comercial, sem FK para `comercial.oportunidades`. O domínio da
-- fórmula (Preço = Custo × (1+Margem) ÷ (1−Alíquota)) vive em TypeScript puro
-- (`features/comercial/domain/precificacao.ts`) — aqui só o cadastro.
--
-- `niveis_tecnico.cargo_pcm` mapeia o nível a um cargo real de `pcm.funcionarios.cargo` (texto,
-- sem FK — é outro schema e o valor é livre). Verificado em produção (2026-08-11): só 4
-- funcionários ativos, com o MESMO cargo grafado de duas formas ("Oficial de Manutenção" e "Of.
-- de Manutenção") — confirma que casar por igualdade de string é frágil. A UI oferece os cargos
-- reais como lista (distinct de `pcm.funcionarios`), nunca campo livre, para não introduzir typo
-- novo. Nível sem `cargo_pcm` (ou sem funcionário correspondente) cai no fallback do AC-4 — que,
-- dado o cadastro real, vai ser o caminho comum no início, não exceção.
--
-- Rollback:
--   drop table if exists comercial.materiais;
--   drop table if exists comercial.niveis_tecnico;
--   drop table if exists comercial.parametros_preco;

-- ─────────────────────────── PARÂMETROS (singleton) ─────────────────────────
-- Mesmo padrão de `financeiro.config_impostos` (E04-S10): `id` fixo, `check (id = 1)` trava a
-- segunda linha.

create table comercial.parametros_preco (
  id                          int         primary key default 1,
  margem_alvo_pct             numeric(6, 3) not null default 20 check (margem_alvo_pct >= 0),
  overhead_pct                numeric(6, 3) not null default 10 check (overhead_pct >= 0),
  beneficios_pct              numeric(6, 3) not null default 30 check (beneficios_pct >= 0),
  suporte_pct                 numeric(6, 3) not null default 5 check (suporte_pct >= 0),
  veiculo_mensal_centavos     bigint      not null default 0 check (veiculo_mensal_centavos >= 0),
  markup_material_padrao_pct  numeric(6, 3) not null default 20 check (markup_material_padrao_pct >= 0),
  -- AC-9: no Anexo IV o INSS patronal (CPP) fica FORA do DAS; no Anexo III fica DENTRO. Se os
  -- encargos cadastrados em financeiro.custos_funcionario já incluem CPP e a empresa é Anexo III,
  -- contar de novo aqui dobraria o encargo. Confirmar uma vez com o contador, não a cada proposta.
  mo_inclui_inss_patronal     boolean     not null default true,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid        references auth.users,
  constraint parametros_preco_singleton check (id = 1)
);

alter table comercial.parametros_preco enable row level security;
alter table comercial.parametros_preco force row level security;

grant select, insert, update on comercial.parametros_preco to authenticated;
grant select, insert, update, delete on comercial.parametros_preco to service_role;

create policy "parametros_preco_select" on comercial.parametros_preco for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "parametros_preco_escrita" on comercial.parametros_preco for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

insert into comercial.parametros_preco (id) values (1) on conflict (id) do nothing;

-- ─────────────────────────── NÍVEIS DE TÉCNICO ──────────────────────────────

create table comercial.niveis_tecnico (
  id                                uuid        primary key default gen_random_uuid(),
  nome                              text        not null unique,
  custo_mensal_referencia_centavos  bigint      not null check (custo_mensal_referencia_centavos >= 0),
  -- 220h é o valor real usado em todas as 16 linhas de financeiro.custos_funcionario hoje —
  -- mesma base pra converter referência mensal em custo/hora quando não há dado do Financeiro.
  horas_mes_referencia              numeric(6, 2) not null default 220 check (horas_mes_referencia > 0),
  cargo_pcm                         text,
  ativo                             boolean     not null default true,
  created_at                        timestamptz not null default now(),
  created_by                        uuid        references auth.users,
  updated_at                        timestamptz not null default now(),
  updated_by                        uuid        references auth.users
);

alter table comercial.niveis_tecnico enable row level security;
alter table comercial.niveis_tecnico force row level security;

grant select, insert, update, delete on comercial.niveis_tecnico to authenticated;
grant select, insert, update, delete on comercial.niveis_tecnico to service_role;

create policy "niveis_tecnico_select" on comercial.niveis_tecnico for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "niveis_tecnico_escrita" on comercial.niveis_tecnico for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

-- ─────────────────────────── CATÁLOGO DE MATERIAIS ──────────────────────────

create table comercial.materiais (
  id                        uuid        primary key default gen_random_uuid(),
  nome                      text        not null,
  unidade                   text        not null,
  custo_referencia_centavos bigint      not null check (custo_referencia_centavos >= 0),
  markup_pct                numeric(6, 3) check (markup_pct >= 0),  -- null herda o padrão (AC-8)
  ativo                     boolean     not null default true,
  created_at                timestamptz not null default now(),
  created_by                uuid        references auth.users,
  updated_at                timestamptz not null default now(),
  updated_by                uuid        references auth.users
);

create index idx_materiais_nome on comercial.materiais (nome) where ativo;

alter table comercial.materiais enable row level security;
alter table comercial.materiais force row level security;

grant select, insert, update, delete on comercial.materiais to authenticated;
grant select, insert, update, delete on comercial.materiais to service_role;

create policy "materiais_select" on comercial.materiais for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  );
create policy "materiais_escrita" on comercial.materiais for all to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'comercial' = 'escrita'
  );

comment on column comercial.niveis_tecnico.cargo_pcm is
  'Cargo real de pcm.funcionarios.cargo (texto livre, sem FK — schema diferente). UI oferece '
  'como lista dos cargos distintos cadastrados, nunca campo digitável — cargos reais têm grafia '
  'inconsistente em produção (ex.: "Oficial de Manutenção" x "Of. de Manutenção").';
comment on column comercial.materiais.markup_pct is
  'Nulo herda parametros_preco.markup_material_padrao_pct (AC-8) — não duplicar o valor aqui.';
