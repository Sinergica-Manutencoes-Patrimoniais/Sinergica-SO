-- 1913_E01-S204_definicao_os_aberta.sql — Sinérgica SO
-- Ponto C do reteste / DEF-40 / DEF-49: cinco telas contavam "OS abertas" com cinco critérios.
-- Decisões do dono (27/11/2026, D1–D8, ver specs/E01-S204-definicao-os-aberta/spec.md):
--   OS aberta     = OS do read model (já sem ponto de visita) com Chamado e fora de finalizado/cancelado
--                   (validacao_pcm conta — D2);
--   Pré-chamado   = OS sem Chamado (PRE-), contada à parte (D1);
--   Chamado aberto= Chamado aberto/demanda ainda sem OS (linha `chamado_aberto` do read model);
--   Backlog       = OS aberta sem data, sem técnico e sem tarefa Auvo (D3);
--   Demanda em aberto = OS abertas + pré-chamados + chamados abertos (D4).
-- A classificação mora num só lugar (pcm.fn_classificar_item_operacao) e as duas contagens a usam.
-- Aditiva: não altera tabela, view nem as RPCs antigas (fn_kpis_operacao/fn_kpis_ordens_servico
-- seguem para quem ainda as chama durante o deploy).
--
-- Reverso:
--   drop function if exists pcm.fn_contagem_operacional_por_cliente(uuid);
--   drop function if exists pcm.fn_demanda_em_aberto(text, uuid, uuid, text, date, date);
--   drop function if exists pcm.fn_classificar_item_operacao(text, text, uuid, timestamptz, uuid, bigint);

create or replace function pcm.fn_classificar_item_operacao(
  p_item_tipo text,
  p_status text,
  p_chamado_id uuid,
  p_data_agendada timestamptz,
  p_tecnico_funcionario_id uuid,
  p_auvo_task_id bigint
)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select case
    when p_item_tipo = 'chamado_aberto' then 'chamado_aberto'
    when p_status in ('finalizado', 'cancelado') then 'historico'
    when p_chamado_id is null then 'pre_chamado'
    when p_data_agendada is null and p_tecnico_funcionario_id is null and p_auvo_task_id is null
      then 'backlog'
    else 'os_aberta'
  end;
$$;

comment on function pcm.fn_classificar_item_operacao(text, text, uuid, timestamptz, uuid, bigint) is
  'E01-S204: classificação única de uma linha de pcm.operacao_itens. backlog é subconjunto de OS aberta: quem conta OS abertas soma os_aberta + backlog.';

create or replace function pcm.fn_demanda_em_aberto(
  p_busca text default null,
  p_cliente_id uuid default null,
  p_tecnico_funcionario_id uuid default null,
  p_categoria text default null,
  p_data_inicio date default null,
  p_data_fim date default null
)
returns table (
  os_abertas bigint,
  backlog bigint,
  pre_chamados bigint,
  chamados_abertos bigint,
  demanda_em_aberto bigint
)
language sql
stable
security invoker
set search_path = pcm, public
as $$
  with classificados as (
    select pcm.fn_classificar_item_operacao(
      item_tipo, status, chamado_id, data_agendada, tecnico_funcionario_id, auvo_task_id
    ) as classe
    from pcm.operacao_itens
    -- Mesmos filtros de pcm.fn_kpis_operacao: as parcelas somam o "abertas" dela.
    where (p_cliente_id is null or cliente_id = p_cliente_id)
      and (p_tecnico_funcionario_id is null or tecnico_funcionario_id = p_tecnico_funcionario_id)
      and (p_categoria is null or categoria = p_categoria)
      and (p_data_inicio is null or created_at >= p_data_inicio::timestamptz)
      and (p_data_fim is null or created_at < (p_data_fim + 1)::timestamptz)
      and (
        nullif(trim(p_busca), '') is null
        or numero ilike '%' || trim(p_busca) || '%'
        or titulo ilike '%' || trim(p_busca) || '%'
        or cliente_nome ilike '%' || trim(p_busca) || '%'
      )
  )
  select
    count(*) filter (where classe in ('os_aberta', 'backlog')),
    count(*) filter (where classe = 'backlog'),
    count(*) filter (where classe = 'pre_chamado'),
    count(*) filter (where classe = 'chamado_aberto'),
    count(*) filter (where classe <> 'historico')
  from classificados;
$$;

revoke all on function pcm.fn_demanda_em_aberto(text, uuid, uuid, text, date, date) from public;
grant execute on function pcm.fn_demanda_em_aberto(text, uuid, uuid, text, date, date) to authenticated;

comment on function pcm.fn_demanda_em_aberto(text, uuid, uuid, text, date, date) is
  'E01-S204: Demanda em aberto em três parcelas (OS abertas, pré-chamados, chamados abertos) + backlog. security invoker: RLS do read model filtra.';

create or replace function pcm.fn_contagem_operacional_por_cliente(p_cliente_id uuid default null)
returns table (
  cliente_id uuid,
  os_abertas bigint,
  backlog bigint,
  pre_chamados bigint,
  chamados_abertos bigint,
  demanda_em_aberto bigint
)
language sql
stable
security invoker
set search_path = pcm, public
as $$
  with classificados as (
    select i.cliente_id,
      pcm.fn_classificar_item_operacao(
        i.item_tipo, i.status, i.chamado_id, i.data_agendada, i.tecnico_funcionario_id, i.auvo_task_id
      ) as classe
    from pcm.operacao_itens i
    where p_cliente_id is null or i.cliente_id = p_cliente_id
  )
  select
    c.cliente_id,
    count(*) filter (where c.classe in ('os_aberta', 'backlog')),
    count(*) filter (where c.classe = 'backlog'),
    count(*) filter (where c.classe = 'pre_chamado'),
    count(*) filter (where c.classe = 'chamado_aberto'),
    count(*) filter (where c.classe <> 'historico')
  from classificados c
  group by c.cliente_id;
$$;

revoke all on function pcm.fn_contagem_operacional_por_cliente(uuid) from public;
grant execute on function pcm.fn_contagem_operacional_por_cliente(uuid) to authenticated;

comment on function pcm.fn_contagem_operacional_por_cliente(uuid) is
  'E01-S204: as mesmas parcelas de fn_demanda_em_aberto, uma linha por Cliente (carteira, Visão 360 e card do Início). Cliente sem item não devolve linha (= zero).';
