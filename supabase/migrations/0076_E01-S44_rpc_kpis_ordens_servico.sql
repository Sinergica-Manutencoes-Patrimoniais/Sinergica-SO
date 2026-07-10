-- 0076_E01-S44_rpc_kpis_ordens_servico.sql — Sinérgica SO
-- Os 6 KPIs do topo de Ordens de Serviço eram `reduce` em JavaScript sobre o array inteiro
-- carregado no navegador (`buscarTodasOrdens` baixa até 10 mil linhas, sem filtro no WHERE — já
-- causou um bug real em produção, PR #41, `limit(200)` truncando os números). RPC agregada substitui
-- isso: 6 números via `count(*) filter (...)`, sem baixar nenhuma linha de OS pro cliente.
--
-- SEM `security definer` DE PROPÓSITO — mesmo raciocínio de `atendimento.fn_metrics_snapshot`
-- (migration 0052): rodando com o privilégio de quem chama (`security invoker`, o padrão), a RLS
-- FORCE já existente em `pcm.ordens_servico` filtra sozinha por `pcm:leitura`, sem duplicar a
-- checagem de permissão aqui dentro.
--
-- Reverso:
--   drop function if exists pcm.fn_kpis_ordens_servico(text, uuid, text, date, date);

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
    and (p_status is null or status = p_status)
    and (p_tecnico_funcionario_id is null or tecnico_funcionario_id = p_tecnico_funcionario_id)
    and (p_categoria is null or categoria = p_categoria)
    and (p_data_inicio is null or created_at::date >= p_data_inicio)
    and (p_data_fim is null or created_at::date <= p_data_fim);
$$;

revoke all on function pcm.fn_kpis_ordens_servico(text, uuid, text, date, date) from public;
grant execute on function pcm.fn_kpis_ordens_servico(text, uuid, text, date, date) to authenticated;

comment on function pcm.fn_kpis_ordens_servico(text, uuid, text, date, date)
  is 'E01-S44: KPIs de Ordens de Serviço agregados no servidor — substitui reduce() em JS sobre o array completo. security invoker: RLS de pcm.ordens_servico filtra por pcm:leitura sem lógica duplicada aqui.';
