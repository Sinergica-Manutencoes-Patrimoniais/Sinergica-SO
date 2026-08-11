-- 0178_E01-S145_operacao_read_model_paginado.sql — Sinérgica SO
-- Read model mínimo do board Chamados/OS, KPIs unificados e mutação em lote.
-- Migration aditiva: contratos antigos permanecem disponíveis para rollback do frontend.
--
-- Reverso:
--   drop function if exists pcm.fn_operacao_alterar_status_lote(uuid[], text);
--   drop function if exists pcm.fn_kpis_operacao(text, uuid, uuid, text, date, date);
--   drop view if exists pcm.operacao_itens;
--   drop index if exists pcm.idx_os_operacao_status_created;
--   drop index if exists pcm.idx_os_operacao_ativos_created;
--   drop index if exists pcm.idx_os_operacao_cliente_created;
--   drop index if exists pcm.idx_os_operacao_agenda;
--   drop index if exists pcm.idx_chamados_operacao_abertos_created;

create index if not exists idx_os_operacao_status_created
  on pcm.ordens_servico (status, created_at desc, id)
  where deleted_at is null;

create index if not exists idx_os_operacao_ativos_created
  on pcm.ordens_servico (created_at desc, id)
  where deleted_at is null and status not in ('finalizado', 'cancelado');

create index if not exists idx_os_operacao_cliente_created
  on pcm.ordens_servico (client_id, created_at desc, id)
  where deleted_at is null;

create index if not exists idx_os_operacao_agenda
  on pcm.ordens_servico (data_agendada, id)
  where deleted_at is null and data_agendada is not null;

create index if not exists idx_chamados_operacao_abertos_created
  on pcm.chamados (created_at desc, id)
  where deleted_at is null and status = 'aberto';

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
  and lower(trim(o.titulo)) not in ('inicio visita', 'fim visita')

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
  'E01-S145: read model mínimo e security-invoker do board unificado Chamados/OS; detalhes pesados são lazy.';

create or replace function pcm.fn_kpis_operacao(
  p_busca text default null,
  p_cliente_id uuid default null,
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
  from pcm.operacao_itens
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
    );
$$;

revoke all on function pcm.fn_kpis_operacao(text, uuid, uuid, text, date, date) from public;
grant execute on function pcm.fn_kpis_operacao(text, uuid, uuid, text, date, date) to authenticated;

comment on function pcm.fn_kpis_operacao(text, uuid, uuid, text, date, date) is
  'E01-S145: KPIs globais do read model; respeita filtros exceto status e herda RLS via security invoker.';

create or replace function pcm.fn_operacao_alterar_status_lote(
  p_ids uuid[],
  p_status text
)
returns table (
  id uuid,
  sucesso boolean,
  erro text
)
language plpgsql
security invoker
set search_path = pcm, public
as $$
declare
  v_id uuid;
begin
  if p_status not in (
    'solicitacao', 'corretiva', 'backlog', 'planejamento',
    'em_execucao', 'finalizado', 'cancelado'
  ) then
    raise exception 'Status de OS inválido: %', p_status using errcode = '22023';
  end if;

  foreach v_id in array coalesce(p_ids, array[]::uuid[])
  loop
    begin
      update pcm.ordens_servico os
      set status = p_status,
          updated_at = now(),
          updated_by = auth.uid()
      where os.id = v_id
        and os.deleted_at is null;

      id := v_id;
      sucesso := found;
      erro := case when found then null else 'OS não encontrada ou sem permissão' end;
      return next;
    exception when others then
      id := v_id;
      sucesso := false;
      erro := sqlerrm;
      return next;
    end;
  end loop;
end;
$$;

revoke all on function pcm.fn_operacao_alterar_status_lote(uuid[], text) from public;
grant execute on function pcm.fn_operacao_alterar_status_lote(uuid[], text) to authenticated;

comment on function pcm.fn_operacao_alterar_status_lote(uuid[], text) is
  'E01-S145: altera status de várias OS em um round-trip, preservando sucesso/erro individual.';
