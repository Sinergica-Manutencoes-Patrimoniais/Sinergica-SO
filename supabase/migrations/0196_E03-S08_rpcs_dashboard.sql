-- 0196_E03-S08_rpcs_dashboard.sql — Sinérgica SO
-- Story E03-S08. Agregação server-side pro Dashboard Comercial — nunca baixar `oportunidades`/
-- `propostas` inteiras pro browser (mesmo padrão de `financeiro.fn_resumo_caixa`, E04-S03, migration
-- 0107). SEM security definer: `security invoker` deixa a RLS FORCE de `comercial.*` filtrar
-- sozinha por `user_modulos.comercial` — sem duplicar checagem de permissão aqui dentro. Um usuário
-- sem o módulo recebe agregados vazios (0/null), nunca erro; o gate de "rota negada" (AC-10) é da UI.
--
-- "Período" usa `created_at`/`fechada_em` — não existe uma tabela de auditoria de mudança de status
-- de proposta (só `proposta_versoes`, que é por VERSÃO de composição, não por transição de status),
-- então "propostas enviadas no período" usa `created_at` como proxy — documentado no comment de
-- `fn_desconto_medio`.
--
-- Rollback:
--   drop function if exists comercial.fn_origem_leads(date, date);
--   drop function if exists comercial.fn_desconto_medio(date, date);
--   drop function if exists comercial.fn_ticket_medio(date, date);
--   drop function if exists comercial.fn_win_loss(date, date);
--   drop function if exists comercial.fn_ciclo_venda(date, date);
--   drop function if exists comercial.fn_conversao_etapas(date, date);

-- ─────────────────────────── AC-2: conversão por etapa ──────────────────────
-- "Entrou" = evento com etapa_para = esta etapa no período. "Avançou" = evento com etapa_de = esta
-- etapa no período (saiu dela pra QUALQUER destino — casos de borda: pular etapa não conta como
-- "passou pelas puladas", só a transição real registrada importa).
create or replace function comercial.fn_conversao_etapas(p_inicio date, p_fim date)
returns table (
  etapa_id uuid,
  etapa_nome text,
  etapa_ordem int,
  entraram bigint,
  avancaram bigint
)
language sql
stable
security invoker
set search_path = comercial, pg_temp
as $$
  select
    e.id, e.nome, e.ordem,
    coalesce(ent.qtd, 0),
    coalesce(av.qtd, 0)
  from comercial.etapas_funil e
  left join (
    select etapa_para, count(distinct oportunidade_id) as qtd
    from comercial.oportunidade_eventos
    where ocorrido_em::date between p_inicio and p_fim
    group by etapa_para
  ) ent on ent.etapa_para = e.id
  left join (
    select etapa_de, count(distinct oportunidade_id) as qtd
    from comercial.oportunidade_eventos
    where ocorrido_em::date between p_inicio and p_fim and etapa_de is not null
    group by etapa_de
  ) av on av.etapa_de = e.id
  where e.ativo
  order by e.ordem;
$$;

revoke all on function comercial.fn_conversao_etapas(date, date) from public;
grant execute on function comercial.fn_conversao_etapas(date, date) to authenticated;

-- ─────────────────────────── AC-3: ciclo de venda (mediana) ─────────────────
-- `fechada_em` é sempre o ÚLTIMO fechamento por construção: o trigger `fn_oportunidade_fechamento`
-- (0176) zera `fechada_em` toda vez que a oportunidade volta pra etapa aberta e regrava na hora de
-- fechar de novo — não precisa derivar "o último" a partir de eventos, a coluna já É isso.
create or replace function comercial.fn_ciclo_venda(p_inicio date, p_fim date)
returns table (mediana_dias numeric, quantidade bigint)
language sql
stable
security invoker
set search_path = comercial, pg_temp
as $$
  select
    percentile_cont(0.5) within group (
      order by extract(day from (fechada_em - created_at))
    ),
    count(*)
  from comercial.oportunidades
  where fechada_em is not null
    and fechada_em::date between p_inicio and p_fim
    and deleted_at is null;
$$;

revoke all on function comercial.fn_ciclo_venda(date, date) from public;
grant execute on function comercial.fn_ciclo_venda(date, date) to authenticated;

-- ─────────────────────────── AC-4: win/loss por motivo ──────────────────────
-- Uma linha 'ganha' (motivo_nome null) + uma linha por motivo de perda — o front soma as linhas
-- 'perdida' pra taxa de perda total, e usa `motivo_nome` pra distribuição.
create or replace function comercial.fn_win_loss(p_inicio date, p_fim date)
returns table (categoria text, motivo_nome text, quantidade bigint)
language sql
stable
security invoker
set search_path = comercial, pg_temp
as $$
  select 'ganha'::text, null::text, count(*)
    from comercial.oportunidades o
    join comercial.etapas_funil e on e.id = o.etapa_id
   where e.tipo = 'ganha' and o.fechada_em::date between p_inicio and p_fim
  union all
  select 'perdida'::text, coalesce(m.nome, 'Sem motivo'), count(*)
    from comercial.oportunidades o
    join comercial.etapas_funil e on e.id = o.etapa_id
    left join comercial.motivos_perda m on m.id = o.motivo_perda_id
   where e.tipo = 'perdida' and o.fechada_em::date between p_inicio and p_fim
   group by coalesce(m.nome, 'Sem motivo');
$$;

revoke all on function comercial.fn_win_loss(date, date) from public;
grant execute on function comercial.fn_win_loss(date, date) to authenticated;

-- ─────────────────────────── AC-5: ticket médio (fonte em cascata) ──────────
-- Contrato (S07) > proposta aceita (S04) > valor_estimado da oportunidade — nessa ordem. As 3
-- contagens de fonte viajam junto pra UI poder dizer "X vieram do contrato, Y da proposta, Z do
-- estimado", em vez de esconder a origem do número.
create or replace function comercial.fn_ticket_medio(p_inicio date, p_fim date)
returns table (
  ticket_medio_centavos bigint,
  quantidade bigint,
  fonte_contrato bigint,
  fonte_proposta bigint,
  fonte_estimado bigint
)
language sql
stable
security invoker
set search_path = comercial, pg_temp
as $$
  with ganhas as (
    select
      o.id,
      o.valor_estimado_centavos,
      (
        select p.preco_centavos from comercial.propostas p
         where p.oportunidade_id = o.id and p.status = 'aceita'
         order by p.created_at desc limit 1
      ) as preco_proposta,
      (
        select c.valor_mensal_centavos from comercial.contratos c
         join comercial.propostas p2 on p2.id = c.proposta_id
         where p2.oportunidade_id = o.id
         order by c.created_at desc limit 1
      ) as valor_contrato
    from comercial.oportunidades o
    join comercial.etapas_funil e on e.id = o.etapa_id
   where e.tipo = 'ganha' and o.fechada_em::date between p_inicio and p_fim
  )
  select
    avg(coalesce(valor_contrato, preco_proposta, valor_estimado_centavos))::bigint,
    count(*),
    count(*) filter (where valor_contrato is not null),
    count(*) filter (where valor_contrato is null and preco_proposta is not null),
    count(*) filter (
      where valor_contrato is null and preco_proposta is null and valor_estimado_centavos is not null
    )
  from ganhas;
$$;

revoke all on function comercial.fn_ticket_medio(date, date) from public;
grant execute on function comercial.fn_ticket_medio(date, date) to authenticated;

-- ─────────────────────────── AC-6: desconto médio × piso ────────────────────
-- "Enviadas no período" usa `created_at` como proxy (não existe timestamp de "quando virou
-- enviada" — só o snapshot por versão em `proposta_versoes`, que é outra granularidade).
create or replace function comercial.fn_desconto_medio(p_inicio date, p_fim date)
returns table (desconto_medio_pct numeric, quantidade bigint, perto_do_piso bigint)
language sql
stable
security invoker
set search_path = comercial, pg_temp
as $$
  select
    avg(1 - (preco_centavos::numeric / preco_sugerido_centavos)),
    count(*),
    count(*) filter (where preco_centavos::numeric <= piso_centavos * 1.05)
  from comercial.propostas
  where status in ('enviada', 'aceita', 'recusada')
    and created_at::date between p_inicio and p_fim
    and preco_sugerido_centavos > 0;
$$;

revoke all on function comercial.fn_desconto_medio(date, date) from public;
grant execute on function comercial.fn_desconto_medio(date, date) to authenticated;

comment on function comercial.fn_desconto_medio(date, date) is
  'E03-S08 AC-6/AC-8: desconto médio (1 - preço/preço sugerido) e contagem perto do piso (≤5% acima)'
  ' entre propostas que saíram do rascunho no período. Retorna 0 linhas se comercial.propostas '
  'estiver vazia (AC-8, degradação honesta) — o front trata ausência de linha como "sem dados", '
  'nunca como zero.';

-- ─────────────────────────── AC-7: origem do lead ───────────────────────────
create or replace function comercial.fn_origem_leads(p_inicio date, p_fim date)
returns table (origem text, total bigint, ganhas bigint)
language sql
stable
security invoker
set search_path = comercial, pg_temp
as $$
  select
    coalesce(o.origem, 'Sem origem'),
    count(*),
    count(*) filter (where e.tipo = 'ganha')
  from comercial.oportunidades o
  join comercial.etapas_funil e on e.id = o.etapa_id
  where o.created_at::date between p_inicio and p_fim
    and o.deleted_at is null
  group by coalesce(o.origem, 'Sem origem');
$$;

revoke all on function comercial.fn_origem_leads(date, date) from public;
grant execute on function comercial.fn_origem_leads(date, date) to authenticated;
