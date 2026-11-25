-- 1900_E06-S01_marketing_indicadores_meta.sql — Sinérgica SO
-- Fundação do bounded context Marketing: indicadores das campanhas da Meta e rastreio
-- anúncio → lead → oportunidade → contrato. ADR-1699.
--
-- O schema `marketing` nasceu declarado em 0001_E00-S00 ("Marketing: calendário, conteúdo") e
-- nunca ganhou uma tabela. É esta migration que o preenche. Nomes sem prefixo `sso_` porque isto
-- é FUNDAÇÃO de contexto novo, mesmo caso de 0175_E03-S01 (`comercial.oportunidades`); o prefixo
-- marca tabela acrescentada a um domínio que já existia.
--
-- ESCRITA NA API DA META ESTÁ FORA DE ESCOPO (FR-017 da spec, ADR-1699 §6). Nada aqui grava na
-- plataforma; tudo é cópia re-sincronizável do que ela informa.
--
-- Reverso:
--   drop function if exists marketing.fn_token_meta();
--   drop function if exists marketing.fn_vincular_oportunidade(uuid, uuid);
--   drop function if exists marketing.fn_registrar_entrada_anuncio(text, text, text, text, timestamptz);
--   drop function if exists marketing.fn_receita_por_campanha(date, date);
--   drop function if exists marketing.fn_metricas_periodo(date, date);
--   drop table if exists marketing.sso_indicadores_meta_gate;
--   drop table if exists marketing.sincronizacoes;
--   drop table if exists marketing.entradas_anuncio;
--   drop table if exists marketing.links_rastreados;
--   drop table if exists marketing.metricas_anuncio_dia;
--   drop table if exists marketing.anuncios;
--   drop table if exists marketing.conjuntos;
--   drop table if exists marketing.campanhas;
--   drop table if exists marketing.contas_anuncio;
--   (nunca apagar `sincronizacoes` em produção sem exportar antes — é o histórico de operação)

grant usage on schema marketing to authenticated, service_role;

-- ─────────────────────────── HIERARQUIA DA PLATAFORMA ───────────────────────
-- Chave natural em toda tabela: é ela que faz a sincronização ser idempotente (AC-9). A conta
-- NUNCA guarda credencial — o token mora no Vault (ver `fn_token_meta` no fim do arquivo).

create table if not exists marketing.contas_anuncio (
  id                uuid        primary key default gen_random_uuid(),
  plataforma        text        not null default 'meta' check (plataforma = 'meta'),
  conta_externa_id  text        not null check (conta_externa_id ~ '^[0-9]{1,32}$'),
  nome              text        not null check (length(btrim(nome)) between 1 and 200),
  moeda             text        not null default 'BRL' check (moeda ~ '^[A-Z]{3}$'),
  fuso              text        not null default 'America/Sao_Paulo',
  ativa             boolean     not null default true,
  sincronizada_em   timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz,
  unique (plataforma, conta_externa_id)
);

create table if not exists marketing.campanhas (
  id                   uuid        primary key default gen_random_uuid(),
  conta_id             uuid        not null references marketing.contas_anuncio (id) on delete cascade,
  campanha_externa_id  text        not null check (campanha_externa_id ~ '^[0-9]{1,32}$'),
  nome                 text        not null,
  objetivo             text,
  situacao             text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz,
  unique (conta_id, campanha_externa_id)
);
create index if not exists idx_marketing_campanhas_conta on marketing.campanhas (conta_id);

create table if not exists marketing.conjuntos (
  id                   uuid        primary key default gen_random_uuid(),
  campanha_id          uuid        not null references marketing.campanhas (id) on delete cascade,
  conjunto_externo_id  text        not null check (conjunto_externo_id ~ '^[0-9]{1,32}$'),
  nome                 text        not null,
  situacao             text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz,
  unique (campanha_id, conjunto_externo_id)
);
create index if not exists idx_marketing_conjuntos_campanha on marketing.conjuntos (campanha_id);

-- `anuncio_externo_id` é unique GLOBAL, não por conjunto: o ad id da Meta é único na plataforma
-- inteira, e um anúncio pode ser movido de conjunto sem mudar de id.
create table if not exists marketing.anuncios (
  id                  uuid        primary key default gen_random_uuid(),
  conjunto_id         uuid        not null references marketing.conjuntos (id) on delete cascade,
  anuncio_externo_id  text        not null unique check (anuncio_externo_id ~ '^[0-9]{1,32}$'),
  nome                text        not null,
  situacao            text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz
);
create index if not exists idx_marketing_anuncios_conjunto on marketing.anuncios (conjunto_id);

-- O GRÃO DE TUDO. `primary key (anuncio_id, dia)` é a chave de idempotência das métricas (AC-9):
-- é exatamente o que a Meta devolve com `level=ad&time_increment=1`, e qualquer recorte (semana,
-- mês, campanha, conjunto) é derivável por soma. Dinheiro em centavos inteiros (ADR-0001).
create table if not exists marketing.metricas_anuncio_dia (
  anuncio_id      uuid        not null references marketing.anuncios (id) on delete cascade,
  dia             date        not null,
  gasto_centavos  bigint      not null default 0 check (gasto_centavos >= 0),
  alcance         bigint      not null default 0 check (alcance >= 0),
  impressoes      bigint      not null default 0 check (impressoes >= 0),
  cliques         bigint      not null default 0 check (cliques >= 0),
  leads           bigint      not null default 0 check (leads >= 0),
  atualizado_em   timestamptz not null default now(),
  primary key (anuncio_id, dia),
  check (dia >= date '2015-01-01')
);
create index if not exists idx_marketing_metricas_dia on marketing.metricas_anuncio_dia (dia);

-- ─────────────────────────── RASTREIO ATÉ A VENDA ───────────────────────────

create table if not exists marketing.links_rastreados (
  id            uuid        primary key default gen_random_uuid(),
  anuncio_id    uuid        not null references marketing.anuncios (id) on delete cascade,
  token         text        not null unique check (token ~ '^[a-z0-9]{12}$'),
  url_destino   text        not null check (url_destino ~ '^https://'),
  rotulo        text,
  -- Desligar é `ativo = false`; link publicado nunca é apagado, senão o clique de ontem vira
  -- entrada sem origem e a atribuição do passado muda sozinha.
  ativo         boolean     not null default true,
  criado_em     timestamptz not null default now(),
  criado_por    uuid        references auth.users
);
create index if not exists idx_marketing_links_anuncio on marketing.links_rastreados (anuncio_id);

-- `anuncio_id` NULO é um estado legítimo: é a entrada que chegou sem identificação ou com
-- identificação desconhecida (AC-14). Preferimos "sem origem" a atribuir ao anúncio errado.
-- `oportunidade_id` é UNIQUE: uma oportunidade pertence a no máximo uma entrada, senão a mesma
-- receita seria creditada a duas campanhas (AC-15). A FK atravessa o schema de propósito —
-- ver ADR-1699 §2: FK é integridade, não acoplamento de código.
create table if not exists marketing.entradas_anuncio (
  id               uuid        primary key default gen_random_uuid(),
  anuncio_id       uuid        references marketing.anuncios (id),
  link_id          uuid        references marketing.links_rastreados (id),
  token_recebido   text,
  nome             text,
  email            text,
  telefone         text,
  oportunidade_id  uuid        unique references comercial.oportunidades (id),
  ocorrido_em      timestamptz not null default now(),
  criado_em        timestamptz not null default now(),
  criado_por       uuid        references auth.users
);
create index if not exists idx_marketing_entradas_anuncio
  on marketing.entradas_anuncio (anuncio_id, ocorrido_em);
create index if not exists idx_marketing_entradas_oportunidade
  on marketing.entradas_anuncio (oportunidade_id) where oportunidade_id is not null;

-- Append-only (mesmo espírito de `comercial.oportunidade_eventos`): o histórico de operação não
-- se reescreve. Registra inclusive a execução que falhou — é o que prova AC-11.
create table if not exists marketing.sincronizacoes (
  id            uuid        primary key default gen_random_uuid(),
  conta_id      uuid        references marketing.contas_anuncio (id),
  janela_de     date        not null,
  janela_ate    date        not null,
  origem        text        not null check (origem in ('meta', 'demonstracao')),
  resultado     text        not null check (resultado in ('sucesso', 'falha')),
  campanhas     integer     not null default 0 check (campanhas >= 0),
  conjuntos     integer     not null default 0 check (conjuntos >= 0),
  anuncios      integer     not null default 0 check (anuncios >= 0),
  metricas      integer     not null default 0 check (metricas >= 0),
  -- Só código/resumo. NUNCA o corpo da resposta da Meta e NUNCA o token.
  detalhe       text        check (detalhe is null or length(detalhe) <= 1000),
  concluida_em  timestamptz not null default now(),
  check (janela_ate >= janela_de)
);
create index if not exists idx_marketing_sincronizacoes_conta
  on marketing.sincronizacoes (conta_id, concluida_em desc);

-- Gate da jornada (E00-S28). Nasce ABERTO: autorização explícita do Lucas em 25/11/2026 para
-- destravar a exploração. A flag `VITE_SSO_MARKETING_INDICADORES_ENABLED` é o lado do front.
create table if not exists marketing.sso_indicadores_meta_gate (
  id          boolean primary key default true check (id),
  habilitado  boolean not null default false
);
insert into marketing.sso_indicadores_meta_gate (id, habilitado)
  values (true, true)
  on conflict (id) do update set habilitado = excluded.habilitado;

-- ─────────────────────────── RLS ────────────────────────────────────────────
-- Toda tabela: enable + force. GRANT explícito é obrigatório — a RLS do Postgres só é avaliada
-- DEPOIS do privilégio de tabela; sem GRANT a policy nunca roda (db/rls.template.sql).

alter table marketing.contas_anuncio          enable row level security;
alter table marketing.contas_anuncio          force  row level security;
alter table marketing.campanhas               enable row level security;
alter table marketing.campanhas               force  row level security;
alter table marketing.conjuntos               enable row level security;
alter table marketing.conjuntos               force  row level security;
alter table marketing.anuncios                enable row level security;
alter table marketing.anuncios                force  row level security;
alter table marketing.metricas_anuncio_dia    enable row level security;
alter table marketing.metricas_anuncio_dia    force  row level security;
alter table marketing.links_rastreados        enable row level security;
alter table marketing.links_rastreados        force  row level security;
alter table marketing.entradas_anuncio        enable row level security;
alter table marketing.entradas_anuncio        force  row level security;
alter table marketing.sincronizacoes          enable row level security;
alter table marketing.sincronizacoes          force  row level security;
alter table marketing.sso_indicadores_meta_gate enable row level security;
alter table marketing.sso_indicadores_meta_gate force  row level security;

revoke all on marketing.contas_anuncio, marketing.campanhas, marketing.conjuntos,
  marketing.anuncios, marketing.metricas_anuncio_dia, marketing.links_rastreados,
  marketing.entradas_anuncio, marketing.sincronizacoes, marketing.sso_indicadores_meta_gate
  from public, anon;

grant select, insert, update, delete on marketing.contas_anuncio       to authenticated;
grant select, insert, update, delete on marketing.campanhas            to authenticated;
grant select, insert, update, delete on marketing.conjuntos            to authenticated;
grant select, insert, update, delete on marketing.anuncios             to authenticated;
grant select, insert, update, delete on marketing.metricas_anuncio_dia to authenticated;
grant select, insert, update, delete on marketing.links_rastreados     to authenticated;
grant select, insert, update, delete on marketing.entradas_anuncio     to authenticated;
-- Append-only: sem update/delete nem para superadmin.
grant select, insert                 on marketing.sincronizacoes       to authenticated;
-- Gate: leitura apenas; abrir/fechar é decisão de migration, não de tela.
grant select                         on marketing.sso_indicadores_meta_gate to authenticated;

grant select, insert, update, delete on marketing.contas_anuncio       to service_role;
grant select, insert, update, delete on marketing.campanhas            to service_role;
grant select, insert, update, delete on marketing.conjuntos            to service_role;
grant select, insert, update, delete on marketing.anuncios             to service_role;
grant select, insert, update, delete on marketing.metricas_anuncio_dia to service_role;
grant select, insert, update, delete on marketing.links_rastreados     to service_role;
grant select, insert, update, delete on marketing.entradas_anuncio     to service_role;
grant select, insert                 on marketing.sincronizacoes       to service_role;
grant select                         on marketing.sso_indicadores_meta_gate to service_role;

-- Policies por permissão de módulo (ADR-0004), com RELEITURA AO VIVO (E00-S27/ADR-1691).
--
-- `config.sso_acesso_atual(modulo, nivel)` em vez de ler `user_modulos` direto do JWT: o
-- claim é um retrato do login, e uma policy que confia só nele fica CEGA à revogação até o
-- token expirar — quem foi desligado continua lendo gasto de campanha com o token que já
-- tem no bolso. A função relê `config.usuarios` + `resolver_permissoes_modulo` a cada
-- avaliação, confere que o usuário está ativo e que o papel bate com o do token.
-- Cobrado por `scripts/check-revogacao-coberta.mjs`.
--
-- Escritas à mão, uma a uma: policy é segurança — ler o arquivo tem que bastar para saber
-- quem entra, sem executar um loop de `format()`.

create policy "contas_anuncio_select" on marketing.contas_anuncio for select to authenticated
  using (config.sso_acesso_atual('marketing', 'leitura'));
create policy "contas_anuncio_insert" on marketing.contas_anuncio for insert to authenticated
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "contas_anuncio_update" on marketing.contas_anuncio for update to authenticated
  using (config.sso_acesso_atual('marketing', 'escrita'))
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "contas_anuncio_delete" on marketing.contas_anuncio for delete to authenticated
  -- Apagar dado de plataforma é só superadmin. O `and` não é redundante: o papel vem
  -- do token, a confirmação de que ele ainda vale vem do banco.
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    and config.sso_acesso_atual('marketing', 'escrita')
  );

create policy "campanhas_select" on marketing.campanhas for select to authenticated
  using (config.sso_acesso_atual('marketing', 'leitura'));
create policy "campanhas_insert" on marketing.campanhas for insert to authenticated
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "campanhas_update" on marketing.campanhas for update to authenticated
  using (config.sso_acesso_atual('marketing', 'escrita'))
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "campanhas_delete" on marketing.campanhas for delete to authenticated
  -- Apagar dado de plataforma é só superadmin. O `and` não é redundante: o papel vem
  -- do token, a confirmação de que ele ainda vale vem do banco.
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    and config.sso_acesso_atual('marketing', 'escrita')
  );

create policy "conjuntos_select" on marketing.conjuntos for select to authenticated
  using (config.sso_acesso_atual('marketing', 'leitura'));
create policy "conjuntos_insert" on marketing.conjuntos for insert to authenticated
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "conjuntos_update" on marketing.conjuntos for update to authenticated
  using (config.sso_acesso_atual('marketing', 'escrita'))
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "conjuntos_delete" on marketing.conjuntos for delete to authenticated
  -- Apagar dado de plataforma é só superadmin. O `and` não é redundante: o papel vem
  -- do token, a confirmação de que ele ainda vale vem do banco.
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    and config.sso_acesso_atual('marketing', 'escrita')
  );

create policy "anuncios_select" on marketing.anuncios for select to authenticated
  using (config.sso_acesso_atual('marketing', 'leitura'));
create policy "anuncios_insert" on marketing.anuncios for insert to authenticated
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "anuncios_update" on marketing.anuncios for update to authenticated
  using (config.sso_acesso_atual('marketing', 'escrita'))
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "anuncios_delete" on marketing.anuncios for delete to authenticated
  -- Apagar dado de plataforma é só superadmin. O `and` não é redundante: o papel vem
  -- do token, a confirmação de que ele ainda vale vem do banco.
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    and config.sso_acesso_atual('marketing', 'escrita')
  );

create policy "metricas_anuncio_dia_select" on marketing.metricas_anuncio_dia for select to authenticated
  using (config.sso_acesso_atual('marketing', 'leitura'));
create policy "metricas_anuncio_dia_insert" on marketing.metricas_anuncio_dia for insert to authenticated
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "metricas_anuncio_dia_update" on marketing.metricas_anuncio_dia for update to authenticated
  using (config.sso_acesso_atual('marketing', 'escrita'))
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "metricas_anuncio_dia_delete" on marketing.metricas_anuncio_dia for delete to authenticated
  -- Apagar dado de plataforma é só superadmin. O `and` não é redundante: o papel vem
  -- do token, a confirmação de que ele ainda vale vem do banco.
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    and config.sso_acesso_atual('marketing', 'escrita')
  );

create policy "links_rastreados_select" on marketing.links_rastreados for select to authenticated
  using (config.sso_acesso_atual('marketing', 'leitura'));
create policy "links_rastreados_insert" on marketing.links_rastreados for insert to authenticated
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "links_rastreados_update" on marketing.links_rastreados for update to authenticated
  using (config.sso_acesso_atual('marketing', 'escrita'))
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "links_rastreados_delete" on marketing.links_rastreados for delete to authenticated
  -- Apagar dado de plataforma é só superadmin. O `and` não é redundante: o papel vem
  -- do token, a confirmação de que ele ainda vale vem do banco.
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    and config.sso_acesso_atual('marketing', 'escrita')
  );

create policy "entradas_anuncio_select" on marketing.entradas_anuncio for select to authenticated
  using (config.sso_acesso_atual('marketing', 'leitura'));
create policy "entradas_anuncio_insert" on marketing.entradas_anuncio for insert to authenticated
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "entradas_anuncio_update" on marketing.entradas_anuncio for update to authenticated
  using (config.sso_acesso_atual('marketing', 'escrita'))
  with check (config.sso_acesso_atual('marketing', 'escrita'));
create policy "entradas_anuncio_delete" on marketing.entradas_anuncio for delete to authenticated
  -- Apagar dado de plataforma é só superadmin. O `and` não é redundante: o papel vem
  -- do token, a confirmação de que ele ainda vale vem do banco.
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    and config.sso_acesso_atual('marketing', 'escrita')
  );

create policy "sincronizacoes_select" on marketing.sincronizacoes for select to authenticated
  using (config.sso_acesso_atual('marketing', 'leitura'));
create policy "sincronizacoes_insert" on marketing.sincronizacoes for insert to authenticated
  with check (config.sso_acesso_atual('marketing', 'escrita'));
-- O gate da jornada é leitura pública entre autenticados: não é dado, é configuração de
-- alcance, e a tela precisa dele para decidir se se anuncia como não ativada.
create policy "sso_indicadores_meta_gate_select" on marketing.sso_indicadores_meta_gate
  for select to authenticated using (true);

-- ─────────────────────────── LEITURA DOS INDICADORES ────────────────────────
-- Devolve UMA LINHA POR ANÚNCIO com as somas do período. A árvore campanha → conjunto → anúncio e
-- todos os derivados (CPL, CTR, CPC, CPM) são montados em `features/marketing/domain/
-- indicadores.ts`, onde a regra é testável por `vitest` em milissegundos (research.md D5).
-- `security invoker` (padrão): quem autoriza é a RLS das tabelas acima, sem exceção nova.
create or replace function marketing.fn_metricas_periodo(p_de date, p_ate date)
returns table (
  campanha_id uuid, campanha_nome text, campanha_situacao text,
  conjunto_id uuid, conjunto_nome text,
  anuncio_id uuid, anuncio_nome text, anuncio_situacao text,
  tem_numeros boolean,
  gasto_centavos bigint, alcance bigint, impressoes bigint, cliques bigint, leads bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_de is null or p_ate is null or p_ate < p_de or (p_ate - p_de) > 366 then
    raise exception 'periodo_invalido' using errcode = '22023';
  end if;
  return query
    select
      cp.id, cp.nome, cp.situacao,
      cj.id, cj.nome,
      an.id, an.nome, an.situacao,
      -- `tem_numeros` separado de `gasto = 0`: "a Meta ainda não mandou números" e "gastou zero"
      -- são coisas diferentes, e a tela mostra `—` num caso e `0` no outro.
      count(m.dia) > 0,
      coalesce(sum(m.gasto_centavos), 0)::bigint,
      coalesce(sum(m.alcance), 0)::bigint,
      coalesce(sum(m.impressoes), 0)::bigint,
      coalesce(sum(m.cliques), 0)::bigint,
      coalesce(sum(m.leads), 0)::bigint
    from marketing.anuncios an
    join marketing.conjuntos cj on cj.id = an.conjunto_id
    join marketing.campanhas cp on cp.id = cj.campanha_id
    left join marketing.metricas_anuncio_dia m
      on m.anuncio_id = an.id and m.dia between p_de and p_ate
    group by cp.id, cp.nome, cp.situacao, cj.id, cj.nome, an.id, an.nome, an.situacao
    order by cp.nome, cj.nome, an.nome, an.id;
end;
$$;
revoke all on function marketing.fn_metricas_periodo(date, date) from public, anon;
grant execute on function marketing.fn_metricas_periodo(date, date) to authenticated, service_role;

comment on function marketing.fn_metricas_periodo(date, date) is
  'E06-S01 AC-1/AC-2/AC-3: grão anúncio no período, com a hierarquia resolvida. Agregação por '
  'nível e derivados acontecem no domínio do front.';

-- ─────────────────────────── RECEITA POR CAMPANHA ───────────────────────────
-- A ÚNICA travessia Marketing ↔ Comercial (ADR-1699 §2). `security definer` porque precisa ler
-- `comercial.*`, e por isso relê o claim à mão: exige os DOIS módulos. Uma view `security
-- invoker` falharia para quem só tem `marketing`; uma view definer vazaria o Comercial.
-- Receita = valor mensal do contrato quando existe (contrato residente/volante), senão o preço da
-- proposta que o originou (caso `avulso`, que não tem valor mensal por desenho — ver 0190).
create or replace function marketing.fn_receita_por_campanha(p_de date, p_ate date)
returns table (
  campanha_id uuid, campanha_nome text,
  gasto_centavos bigint, leads bigint,
  oportunidades bigint, contratos bigint, receita_centavos bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_de is null or p_ate is null or p_ate < p_de or (p_ate - p_de) > 366 then
    raise exception 'periodo_invalido' using errcode = '22023';
  end if;
  -- AC-17: dado de receita do Comercial não vaza por caminho do Marketing.
  -- Releitura ao vivo (E00-S27/ADR-1691), não o claim do token: a RPC é tão sensível quanto a
  -- policy, e quem foi revogado não pode continuar lendo com o token que já tem. De quebra, a
  -- função devolve boolean — some a armadilha do `NULL in (...)`, que produzia NULL e fazia
  -- `if NULL then raise` NÃO disparar (fail-open silencioso, achado pelo pgTAP do caso negado).
  if not (
    config.sso_acesso_atual('marketing', 'leitura')
    and config.sso_acesso_atual('comercial', 'leitura')
  ) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  return query
    with gasto as (
      select cj.campanha_id as cid, sum(m.gasto_centavos)::bigint as gasto
      from marketing.metricas_anuncio_dia m
      join marketing.anuncios an on an.id = m.anuncio_id
      join marketing.conjuntos cj on cj.id = an.conjunto_id
      where m.dia between p_de and p_ate
      group by cj.campanha_id
    ),
    atribuido as (
      select
        cj.campanha_id as cid,
        count(*)::bigint as leads,
        count(e.oportunidade_id)::bigint as oportunidades,
        count(ct.id)::bigint as contratos,
        coalesce(sum(coalesce(ct.valor_mensal_centavos, pr.preco_centavos)), 0)::bigint as receita
      from marketing.entradas_anuncio e
      join marketing.anuncios an on an.id = e.anuncio_id
      join marketing.conjuntos cj on cj.id = an.conjunto_id
      left join comercial.propostas pr on pr.oportunidade_id = e.oportunidade_id
      left join comercial.contratos ct
        on ct.proposta_id = pr.id and ct.status in ('ativo', 'suspenso', 'encerrado')
      where e.ocorrido_em >= p_de::timestamptz
        and e.ocorrido_em < (p_ate + 1)::timestamptz
      group by cj.campanha_id
    )
    select
      cp.id, cp.nome,
      coalesce(g.gasto, 0)::bigint,
      coalesce(a.leads, 0)::bigint,
      coalesce(a.oportunidades, 0)::bigint,
      coalesce(a.contratos, 0)::bigint,
      coalesce(a.receita, 0)::bigint
    from marketing.campanhas cp
    left join gasto g on g.cid = cp.id
    left join atribuido a on a.cid = cp.id
    -- AC-18: campanha com gasto e sem atribuição NÃO some da lista — esconder o gasto sem
    -- retorno é exatamente o erro que o relatório existe para evitar.
    where coalesce(g.gasto, 0) > 0 or coalesce(a.leads, 0) > 0
    order by coalesce(a.receita, 0) desc, cp.nome;
end;
$$;
revoke all on function marketing.fn_receita_por_campanha(date, date) from public, anon;
grant execute on function marketing.fn_receita_por_campanha(date, date) to authenticated, service_role;

-- ─────────────────────────── ENTRADA E VÍNCULO ──────────────────────────────

create or replace function marketing.fn_registrar_entrada_anuncio(
  p_token text, p_nome text, p_email text, p_telefone text, p_ocorrido_em timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link marketing.links_rastreados%rowtype;
  v_id uuid;
begin
  -- Releitura ao vivo (E00-S27/ADR-1691), não o claim do token: a RPC é tão sensível quanto a
  -- policy, e quem foi revogado não pode continuar lendo com o token que já tem. De quebra, a
  -- função devolve boolean — some a armadilha do `NULL in (...)`, que produzia NULL e fazia
  -- `if NULL then raise` NÃO disparar (fail-open silencioso, achado pelo pgTAP do caso negado).
  if not config.sso_acesso_atual('marketing', 'escrita') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  -- AC-14: token ausente, malformado ou desconhecido vira entrada SEM ORIGEM. Nunca recusamos a
  -- entrada (o lead chegou de verdade) e nunca a atribuímos ao anúncio errado.
  if p_token is not null and p_token ~ '^[a-z0-9]{12}$' then
    select * into v_link from marketing.links_rastreados
      where token = p_token and ativo;
  end if;

  insert into marketing.entradas_anuncio
    (anuncio_id, link_id, token_recebido, nome, email, telefone, ocorrido_em, criado_por)
  values
    (v_link.anuncio_id, v_link.id, p_token, p_nome, p_email, p_telefone,
     coalesce(p_ocorrido_em, now()), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function marketing.fn_registrar_entrada_anuncio(text, text, text, text, timestamptz)
  from public, anon;
grant execute on function marketing.fn_registrar_entrada_anuncio(text, text, text, text, timestamptz)
  to authenticated, service_role;

create or replace function marketing.fn_vincular_oportunidade(
  p_entrada_id uuid, p_oportunidade_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Vincular toca os dois contextos: escrever no Marketing exige escrita lá; apontar para uma
  -- oportunidade exige, no mínimo, poder vê-la no Comercial.
  -- Releitura ao vivo (E00-S27/ADR-1691), não o claim do token: a RPC é tão sensível quanto a
  -- policy, e quem foi revogado não pode continuar lendo com o token que já tem. De quebra, a
  -- função devolve boolean — some a armadilha do `NULL in (...)`, que produzia NULL e fazia
  -- `if NULL then raise` NÃO disparar (fail-open silencioso, achado pelo pgTAP do caso negado).
  if not (
    config.sso_acesso_atual('marketing', 'escrita')
    and config.sso_acesso_atual('comercial', 'leitura')
  ) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  if not exists (select 1 from comercial.oportunidades where id = p_oportunidade_id) then
    raise exception 'oportunidade_inexistente' using errcode = '22023';
  end if;

  -- O `unique` de `oportunidade_id` é quem garante AC-15: a segunda tentativa levanta 23505.
  update marketing.entradas_anuncio
     set oportunidade_id = p_oportunidade_id
   where id = p_entrada_id;
  if not found then
    raise exception 'entrada_inexistente' using errcode = '22023';
  end if;
end;
$$;
revoke all on function marketing.fn_vincular_oportunidade(uuid, uuid) from public, anon;
grant execute on function marketing.fn_vincular_oportunidade(uuid, uuid)
  to authenticated, service_role;

-- ─────────────────────────── CREDENCIAL ─────────────────────────────────────
-- NOME FIXO, sem parâmetro: um `fn_ler_segredo(p_chave)` aberto a `service_role` transformaria
-- qualquer Edge Function do projeto em leitora de qualquer segredo do cofre. Mesmo cuidado que
-- 1847_E02-S35 tomou com a referência opaca. Gravar é pelo cofre que já existe:
--   select config.fn_definir_segredo_integracao('marketing_meta_access_token', '<token>');
-- (0103, só superadmin). O token exigido é de LEITURA (`ads_read`) — não escrevemos na Meta.
create or replace function marketing.fn_token_meta()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare v_valor text;
begin
  select decrypted_secret into v_valor
    from vault.decrypted_secrets where name = 'marketing_meta_access_token';
  return v_valor;
end;
$$;
revoke all on function marketing.fn_token_meta() from public, anon, authenticated;
grant execute on function marketing.fn_token_meta() to service_role;

comment on function marketing.fn_token_meta() is
  'E06-S01: token da Meta (escopo ads_read) lido do Vault por nome fixo. Só service_role — '
  'nenhuma rota do cliente alcança esta função. Nunca devolve o token para o navegador.';

-- ─────────────────────────── CONTA DE DEMONSTRAÇÃO ──────────────────────────
-- Enquanto a Meta não estiver conectada, a sincronização roda em modo demonstração e precisa de
-- uma conta para pendurar os dados. `conta_externa_id = '0'` é reconhecível de longe como não
-- sendo um act_<id> real. Quando a conta de verdade for cadastrada, esta pode ser desativada.
insert into marketing.contas_anuncio (plataforma, conta_externa_id, nome, moeda)
  values ('meta', '0', 'Conta de demonstração', 'BRL')
  on conflict (plataforma, conta_externa_id) do nothing;
