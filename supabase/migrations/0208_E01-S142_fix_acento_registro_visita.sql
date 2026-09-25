-- 0208_E01-S142_fix_acento_registro_visita.sql — Sinérgica SO
-- Bug real achado em produção (2026-08-15, Lucas): OS "INÍCIO VISITA" (CH-0258) continuava
-- aparecendo na lista de Chamados/OS, mesmo com o filtro de E01-S142 (migrations 0173/0178) já em
-- produção. Causa: o título literal do Auvo é "INÍCIO VISITA " (com acento e espaço à direita) —
-- `lower(trim(titulo)) not in ('inicio visita', 'fim visita')` nunca batia porque "início" ≠
-- "inicio" pro Postgres (comparação de string, não de fonema). `translate()` normaliza os acentos
-- comuns do português antes de comparar — mesmo princípio do fix em
-- `apps/web/src/features/pcm/domain/ordens-servico.ts` (ehOsRegistroVisita, NFD + strip diacritic
-- no TypeScript; aqui não há extensão unaccent instalada, translate() resolve sem dependência
-- nova). Afeta os 6 KPIs do topo de Chamados/OS (ambas as telas — hub antigo e Operação unificada)
-- e a listagem em si: os números como "ABERTAS 405" estavam inflados pelas OS de ponto.
--
-- RECONSTRUÍDA nesta sessão (E01-S146) — ver nota em 0205_E02-S31_ia_gasto_log.sql.
--
-- Reverso:
--   (reaplicar as versões anteriores das duas funções — ver migrations 0173 e 0178)

create or replace function pcm.fn_kpis_ordens_servico(
  p_status text default null,
  p_tecnico_funcionario_id uuid default null,
  p_categoria text default null,
  p_data_inicio date default null,
  p_data_fim date default null
)
returns table (
  total bigint,
  abertas bigint,
  em_planejamento bigint,
  em_execucao bigint,
  finalizadas bigint,
  criticas bigint
)
language sql
stable
security invoker
set search_path = pcm, public
as $$
  select
    count(*) as total,
    count(*) filter (where status not in ('finalizado', 'cancelado')) as abertas,
    count(*) filter (where status = 'planejamento') as em_planejamento,
    count(*) filter (where status = 'em_execucao') as em_execucao,
    count(*) filter (where status = 'finalizado') as finalizadas,
    count(*) filter (where prioridade = 'critica') as criticas
  from pcm.ordens_servico
  where deleted_at is null
    and translate(lower(trim(titulo)), 'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc') not in ('inicio visita', 'fim visita')
    and (p_status is null or status = p_status)
    and (p_tecnico_funcionario_id is null or tecnico_funcionario_id = p_tecnico_funcionario_id)
    and (p_categoria is null or categoria = p_categoria)
    and (p_data_inicio is null or created_at::date >= p_data_inicio)
    and (p_data_fim is null or created_at::date <= p_data_fim);
$$;

comment on function pcm.fn_kpis_ordens_servico(text, uuid, text, date, date)
  is 'E01-S44/E01-S142: KPIs de Ordens de Serviço agregados no servidor, excluindo registros de ponto (INÍCIO/FIM VISITA, acento-insensível desde 0208). security invoker: RLS de pcm.ordens_servico filtra por pcm:leitura sem lógica duplicada aqui.';

create or replace view pcm.operacao_itens
with (security_invoker = on) as
select
  o.id::text as item_id,
  'ordem_servico'::text as item_tipo,
  o.id as ordem_servico_id,
  o.chamado_id,
  o.client_id as cliente_id,
  c.nome as cliente_nome,
  o.numero,
  o.titulo,
  o.categoria,
  o.origem,
  o.status,
  o.prioridade,
  o.gravidade,
  o.urgencia,
  o.tendencia,
  o.dor_cliente,
  o.score_pcm,
  o.origem_inspecao_item_id,
  o.auvo_task_id,
  o.auvo_sync_status,
  o.auvo_sync_error,
  o.created_at,
  o.tecnico_funcionario_id,
  f.nome as tecnico_nome,
  o.data_agendada,
  o.check_in_at,
  o.check_out_at,
  o.tipo_os,
  o.pmoc_schedule_id,
  o.auvo_detalhes ->> 'orientacao' as orientacao
from pcm.ordens_servico o
join pcm.clientes c on c.id = o.client_id
left join pcm.funcionarios f on f.id = o.tecnico_funcionario_id
where o.deleted_at is null
  and translate(lower(trim(o.titulo)), 'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc') not in ('inicio visita', 'fim visita')

union all

select
  'chamado-aberto:' || ch.id::text as item_id,
  'chamado_aberto'::text as item_tipo,
  null::uuid as ordem_servico_id,
  ch.id as chamado_id,
  ch.cliente_id,
  c.nome as cliente_nome,
  ch.numero,
  ch.titulo,
  'corretiva'::text as categoria,
  ch.origem,
  'solicitacao'::text as status,
  'normal'::text as prioridade,
  null::int as gravidade,
  null::int as urgencia,
  null::int as tendencia,
  null::int as dor_cliente,
  0::int as score_pcm,
  null::uuid as origem_inspecao_item_id,
  null::bigint as auvo_task_id,
  null::text as auvo_sync_status,
  null::text as auvo_sync_error,
  ch.created_at,
  null::uuid as tecnico_funcionario_id,
  null::text as tecnico_nome,
  null::timestamptz as data_agendada,
  null::timestamptz as check_in_at,
  null::timestamptz as check_out_at,
  null::text as tipo_os,
  null::uuid as pmoc_schedule_id,
  null::text as orientacao
from pcm.chamados ch
join pcm.clientes c on c.id = ch.cliente_id
where ch.deleted_at is null
  and ch.status = 'aberto'
  and not exists (
    select 1
    from pcm.ordens_servico vinculada
    where vinculada.chamado_id = ch.id
      and vinculada.deleted_at is null
  );

grant select on pcm.operacao_itens to authenticated;

comment on view pcm.operacao_itens is
  'E01-S145: read model mínimo e security-invoker do board unificado Chamados/OS; detalhes pesados são lazy. Exclusão de registro de ponto acento-insensível desde 0208.';
