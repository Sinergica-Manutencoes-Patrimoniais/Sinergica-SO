-- 0173_E01-S142_kpis_exclui_registro_visita.sql — Sinérgica SO
-- Técnico abre uma tarefa no Auvo com título literal "INICIO VISITA"/"FIM VISITA" pra bater
-- ponto — vira linha normal em pcm.ordens_servico (usada no apontamento de horas, E01-S133/S134),
-- mas nunca é item de trabalho a tratar. `fn_kpis_ordens_servico` (migration 0076) contava essas
-- linhas nos 6 KPIs do topo de Chamados/OS — exclui pelo título, sem tocar em nenhuma outra RPC/
-- tabela (apontamento de horas continua contando essas OS normalmente).
--
-- Reverso:
--   (reaplicar a versão anterior da função, ver migration 0076_E01-S44_rpc_kpis_ordens_servico.sql)

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
    and lower(trim(titulo)) not in ('inicio visita', 'fim visita')
    and (p_status is null or status = p_status)
    and (p_tecnico_funcionario_id is null or tecnico_funcionario_id = p_tecnico_funcionario_id)
    and (p_categoria is null or categoria = p_categoria)
    and (p_data_inicio is null or created_at::date >= p_data_inicio)
    and (p_data_fim is null or created_at::date <= p_data_fim);
$$;

comment on function pcm.fn_kpis_ordens_servico(text, uuid, text, date, date)
  is 'E01-S44/E01-S142: KPIs de Ordens de Serviço agregados no servidor, excluindo registros de ponto (INICIO/FIM VISITA). security invoker: RLS de pcm.ordens_servico filtra por pcm:leitura sem lógica duplicada aqui.';
