-- ADR-1362. Não reconcilia nem altera vínculos históricos.
create or replace view pcm.operacao_itens
with (security_invoker = on) as
select
  o.id::text as item_id, 'ordem_servico'::text as item_tipo,
  o.id as ordem_servico_id, o.chamado_id, o.client_id as cliente_id,
  c.nome as cliente_nome, o.numero, o.titulo, o.categoria, o.origem,
  o.status, o.prioridade, o.gravidade, o.urgencia, o.tendencia,
  o.dor_cliente, o.score_pcm, o.origem_inspecao_item_id, o.auvo_task_id,
  o.auvo_sync_status, o.auvo_sync_error, o.created_at,
  o.tecnico_funcionario_id, f.nome as tecnico_nome, o.data_agendada,
  o.check_in_at, o.check_out_at, o.tipo_os, o.pmoc_schedule_id,
  o.auvo_detalhes ->> 'orientacao' as orientacao
from pcm.ordens_servico o
join pcm.clientes c on c.id = o.client_id
left join pcm.funcionarios f on f.id = o.tecnico_funcionario_id
where o.deleted_at is null
  and translate(lower(trim(o.titulo)), 'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc') not in ('inicio visita', 'fim visita')
union all
select
  'chamado-aberto:' || ch.id::text as item_id, 'chamado_aberto'::text as item_tipo,
  null::uuid as ordem_servico_id, ch.id as chamado_id, ch.cliente_id,
  c.nome as cliente_nome, ch.numero, ch.titulo, 'corretiva'::text as categoria,
  ch.origem, 'solicitacao'::text as status, 'normal'::text as prioridade,
  null::int as gravidade, null::int as urgencia, null::int as tendencia,
  null::int as dor_cliente, 0::int as score_pcm, null::uuid as origem_inspecao_item_id,
  null::bigint as auvo_task_id, null::text as auvo_sync_status,
  null::text as auvo_sync_error, ch.created_at, null::uuid as tecnico_funcionario_id,
  null::text as tecnico_nome, null::timestamptz as data_agendada,
  null::timestamptz as check_in_at, null::timestamptz as check_out_at,
  null::text as tipo_os, null::uuid as pmoc_schedule_id, null::text as orientacao
from pcm.chamados ch
join pcm.clientes c on c.id = ch.cliente_id
where ch.deleted_at is null
  and ch.status = 'aberto'
  and not exists (
    select 1 from pcm.ordens_servico vinculada
    where vinculada.client_id = ch.cliente_id
      and vinculada.deleted_at is null
      and translate(lower(trim(vinculada.titulo)), 'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc') not in ('inicio visita', 'fim visita')
      and (
        vinculada.chamado_id = ch.id
        or (
          vinculada.id = ch.ordem_servico_id and vinculada.chamado_id is null
          and not exists (
            select 1 from pcm.chamados outro
            where outro.id <> ch.id and outro.cliente_id = ch.cliente_id
              and outro.deleted_at is null and outro.ordem_servico_id = vinculada.id
          )
        )
      )
  );
