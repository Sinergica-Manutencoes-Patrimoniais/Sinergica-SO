-- E01-S192 AC-9 — o Kanban (`pcm.operacao_itens`) nunca expôs `ocorrencia_preventiva_id`, então
-- os 12 cartões preventivos citados na reanálise não tinham como linkar de volta pro Plano que
-- os originou. Adiciona a coluna, aditiva, no fim de cada ramo do UNION (mesma posição nos dois
-- SELECTs — PostgreSQL exige tipos/contagem iguais entre ramos de UNION).
--
-- Reverso: o `create or replace view` anterior (1484) sem esta coluna; nenhum dado é destruído
-- (é view, não tabela).
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
  o.auvo_detalhes ->> 'orientacao' as orientacao,
  o.ocorrencia_preventiva_id
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
  null::text as orientacao,
  null::uuid as ocorrencia_preventiva_id
from pcm.chamados ch
join pcm.clientes c on c.id = ch.cliente_id
where ch.deleted_at is null
  and ch.status = 'aberto'
  and not exists (
    select 1 from pcm.ordens_servico vinculada
    where (vinculada.chamado_id = ch.id or
      (vinculada.id = ch.ordem_servico_id and vinculada.client_id = ch.cliente_id
        and vinculada.chamado_id is null))
      and vinculada.deleted_at is null
  );

-- RPC pontual (lazy, só quando o drawer de detalhe abre) pra resolver o nome do Plano a partir
-- da ocorrência — evita engordar o SELECT do Kanban inteiro com mais um join.
-- Autorização por MÓDULO, não por capacidade granular: quem já enxerga a OS no Kanban (RLS de
-- `pcm.ordens_servico`/`operacao_itens`, mesmo módulo 'pcm') pode ver o nome do Plano que a
-- originou — não é informação mais sensível que a própria OS. Exigir uma ação nomeada aqui
-- reproduziria o achado da E00-S26/E00-S27: capacidade nova que ninguém tem concedida.
create function pcm.sso_resolver_plano_origem_os(p_cliente_id uuid, p_ocorrencia_preventiva_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  -- resolver_permissoes_modulo devolve ZERO linhas pra superadmin de propósito (ele não precisa
  -- de linha por módulo) — por isso o papel entra como alternativa explícita, mesmo padrão de
  -- sso_autorizar_acao/s184_acesso_interno_atual.
  if auth.uid() is null or (
    auth.jwt() ->> 'user_role' is distinct from 'superadmin'
    and not exists (select 1 from config.resolver_permissoes_modulo(auth.uid()) m where m.modulo = 'pcm')
  ) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  -- pcm.ordens_servico.ocorrencia_preventiva_id referencia pcm.ocorrencias_preventivas, que por
  -- sua vez referencia pcm.planos_preventivos — o sistema LEGADO de Plano, separado de
  -- pcm.planos_manutencao (o que a tela Preventivas gerencia hoje, E01-S166 em diante). Os dois
  -- sistemas não são a mesma entidade; resolver aqui o nome do Plano legado é a resposta real —
  -- AC-9 já prevê este caso ("legado sem Plano correspondente [no sistema novo], o que é
  -- informação, não defeito"). Sufixo "(legado)" deixa isso visível, nunca implícito.
  return (
    select p.nome || ' (legado)' from pcm.ocorrencias_preventivas o
    join pcm.planos_preventivos p on p.id = o.plano_id and p.cliente_id = p_cliente_id
    where o.id = p_ocorrencia_preventiva_id
  );
end;
$$;
revoke all on function pcm.sso_resolver_plano_origem_os(uuid, uuid) from public, anon;
grant execute on function pcm.sso_resolver_plano_origem_os(uuid, uuid) to authenticated;
