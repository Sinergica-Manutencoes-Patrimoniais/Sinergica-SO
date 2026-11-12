-- E01-S167 AC-6 (segunda metade): cancelamento NÃO conservador — cancela o Chamado mesmo com
-- escopo pendente. Decisão do Lucas (2026-11-10): toda OS ainda aberta (não finalizada/cancelada)
-- vinculada ao Chamado é cancelada junto, preservando histórico (nunca deletada). Se alguma OS
-- vinculada já tem `auvo_task_id`/`auvo_sync_status` setado, a operação inteira recusa — mesmo
-- padrão de "efeito remoto exige reconciliação" já usado em pcm.sso_transicionar_visita_preparada
-- (0409/E01-S171): Auvo já sabe da OS, cancelamento local silencioso ficaria dessincronizado;
-- fica para a orquestração de reconciliação da E01-S168.
--
-- Esta função só cancela o Chamado e cascateia pras OS; devolver parcela pendente ao Backlog
-- continua sendo pcm.sso_devolver_parcela_chamado_backlog (1830), chamada depois, uma parcela de
-- cada vez, escolhendo o ativo — mesmo fluxo em duas etapas já usado pro caminho suspenso. Por
-- isso esta migration também alarga 1830 pra aceitar Chamado cancelado, não só suspenso.
--
-- Reverso: drop function if exists pcm.sso_cancelar_chamado_forcado(uuid,uuid,uuid,bigint,text);
--          drop table if exists pcm.sso_cancelamentos_forcados_chamado;
--          drop table if exists pcm.sso_cancelamento_forcado_chamado_gate;
--          (reverter sso_devolver_parcela_chamado_backlog exige recriar a versão anterior de 1830)

create table pcm.sso_cancelamento_forcado_chamado_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_cancelamento_forcado_chamado_gate(id, habilitado) values(true, false);
alter table pcm.sso_cancelamento_forcado_chamado_gate enable row level security;
alter table pcm.sso_cancelamento_forcado_chamado_gate force row level security;
revoke all on pcm.sso_cancelamento_forcado_chamado_gate from public, anon, authenticated, service_role;

create table pcm.sso_cancelamentos_forcados_chamado (
  request_id uuid primary key, chamado_id uuid not null references pcm.chamados(id), revisao_anterior bigint not null,
  revisao_resultante bigint not null, motivo text not null check(length(btrim(motivo)) between 1 and 2000),
  os_canceladas jsonb not null, payload jsonb not null, resultado jsonb not null, ator_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);
alter table pcm.sso_cancelamentos_forcados_chamado enable row level security;
alter table pcm.sso_cancelamentos_forcados_chamado force row level security;
revoke all on pcm.sso_cancelamentos_forcados_chamado from public, anon, authenticated, service_role;
create trigger sso_cancelamento_forcado_chamado_imutavel before update or delete on pcm.sso_cancelamentos_forcados_chamado
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_cancelar_chamado_forcado(p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_expected_revision bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_chamado pcm.chamados%rowtype; v_ant pcm.sso_cancelamentos_forcados_chamado%rowtype;
  v_payload jsonb; v_resultado jsonb; v_motivo text := nullif(btrim(p_motivo), ''); v_os_canceladas jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_cancelamento_forcado_chamado_gate where id), false) then
    raise exception 'cancelamento_forcado_desabilitado' using errcode = '55000';
  end if;
  if v_actor is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null or p_expected_revision is null
    or p_expected_revision < 1 or v_motivo is null or length(v_motivo) not between 1 and 2000
  then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('clienteId', p_cliente_id, 'chamadoId', p_chamado_id, 'expectedRevision', p_expected_revision, 'motivo', v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cancelamento-forcado-chamado:' || p_request_id::text, 0));
  select * into v_ant from pcm.sso_cancelamentos_forcados_chamado where request_id = p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_ant.resultado;
  end if;
  select * into v_chamado from pcm.chamados where id = p_chamado_id and cliente_id = p_cliente_id and deleted_at is null for update;
  if not found or config.sso_autorizar_acao('chamado.encerrar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if v_chamado.sso_revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_chamado.status = 'cancelado' or v_chamado.sso_encerrado_em is not null then
    raise exception 'chamado_ja_finalizado' using errcode = '23514';
  end if;
  perform o.id from pcm.ordens_servico o where (o.chamado_id = p_chamado_id or (o.id = v_chamado.ordem_servico_id and o.chamado_id is null))
    and o.deleted_at is null order by o.id for update;
  if exists(
    select 1 from pcm.ordens_servico o where (o.chamado_id = p_chamado_id or (o.id = v_chamado.ordem_servico_id and o.chamado_id is null))
      and o.deleted_at is null and o.status not in ('finalizado', 'cancelado') and (o.auvo_task_id is not null or o.auvo_sync_status is not null)
  ) then raise exception 'efeito_remoto_exige_reconciliacao' using errcode = '23514'; end if;
  select coalesce(jsonb_agg(o.id), '[]'::jsonb) into v_os_canceladas
    from pcm.ordens_servico o where (o.chamado_id = p_chamado_id or (o.id = v_chamado.ordem_servico_id and o.chamado_id is null))
      and o.deleted_at is null and o.status not in ('finalizado', 'cancelado');
  update pcm.ordens_servico set status = 'cancelado', updated_at = now(), updated_by = v_actor
    where (chamado_id = p_chamado_id or (id = v_chamado.ordem_servico_id and chamado_id is null))
      and deleted_at is null and status not in ('finalizado', 'cancelado');
  update pcm.chamados set status = 'cancelado', cancelamento_justificativa = v_motivo, updated_at = now(), updated_by = v_actor
    where id = p_chamado_id returning * into v_chamado;
  v_resultado := jsonb_build_object('chamadoId', p_chamado_id, 'revision', v_chamado.sso_revisao, 'state', 'cancelado',
    'osCanceladas', v_os_canceladas, 'requestId', p_request_id);
  insert into pcm.sso_cancelamentos_forcados_chamado(request_id, chamado_id, revisao_anterior, revisao_resultante, motivo, os_canceladas, payload, resultado, ator_id)
    values (p_request_id, p_chamado_id, p_expected_revision, v_chamado.sso_revisao, v_motivo, v_os_canceladas, v_payload, v_resultado, v_actor);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values (v_actor, 'chamado.cancelamento_forcado', 'chamados', p_chamado_id, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_cancelar_chamado_forcado(uuid, uuid, uuid, bigint, text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_cancelar_chamado_forcado(uuid, uuid, uuid, bigint, text) to authenticated;

-- Alarga sso_devolver_parcela_chamado_backlog (1830) pra aceitar Chamado suspenso OU cancelado,
-- não só suspenso — mesma função, mesmo gate (sso_devolucao_escopo_backlog_gate), sem mudar
-- assinatura nem contrato existente.
create or replace function pcm.sso_devolver_parcela_chamado_backlog(
  p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_parcela_id uuid, p_alvo_tipo text, p_alvo_id uuid, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_anterior pcm.sso_devolucoes_escopo_chamado%rowtype; v_parcela pcm.chamado_escopo_parcelas%rowtype;
  v_composicao_id uuid; v_backlog_id uuid; v_payload jsonb; v_resultado jsonb; v_motivo text := nullif(btrim(p_motivo), '');
  v_cliente_alvo uuid; v_chamado pcm.chamados%rowtype;
begin
  if not coalesce((select habilitado from pcm.sso_devolucao_escopo_backlog_gate where id), false) then
    raise exception 'devolucao_desabilitada' using errcode = '55000';
  end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null or p_parcela_id is null
    or p_alvo_tipo is null or p_alvo_tipo not in ('sistema', 'componente', 'grupo') or p_alvo_id is null
    or v_motivo is null or length(v_motivo) not between 1 and 2000
  then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if p_alvo_tipo = 'sistema' then
    select s.cliente_id into v_cliente_alvo from pcm.sistemas s where s.id = p_alvo_id and s.ativo and s.deleted_at is null for share;
  elsif p_alvo_tipo = 'componente' then
    select e.client_id into v_cliente_alvo from pcm.equipamentos e where e.id = p_alvo_id and e.ativo and e.deleted_at is null for share;
  else
    select g.cliente_id into v_cliente_alvo from pcm.grupos_quantitativos g where g.id = p_alvo_id and g.ativo and g.deleted_at is null for share;
  end if;
  if v_cliente_alvo is distinct from p_cliente_id then raise exception 'alvo_invalido_ou_de_outro_cliente' using errcode = '23514'; end if;
  v_payload := jsonb_build_object('clienteId', p_cliente_id, 'chamadoId', p_chamado_id, 'parcelaId', p_parcela_id,
    'alvoTipo', p_alvo_tipo, 'alvoId', p_alvo_id, 'motivo', v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('devolucao-escopo-chamado:' || p_request_id::text, 0));
  select * into v_anterior from pcm.sso_devolucoes_escopo_chamado where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_anterior.resultado;
  end if;
  if exists(select 1 from pcm.sso_backlog_parcelas where parcela_id = p_parcela_id) then
    raise exception 'parcela_ja_devolvida' using errcode = '23505';
  end if;
  select * into v_chamado from pcm.chamados c where c.id = p_chamado_id and c.cliente_id = p_cliente_id and c.deleted_at is null;
  if not found then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if v_chamado.status <> 'cancelado' and not exists(
    select 1 from pcm.sso_suspensoes_chamado s where s.chamado_id = p_chamado_id and s.cliente_id = p_cliente_id and s.estado = 'suspenso'
  ) then raise exception 'chamado_nao_suspenso_nem_cancelado' using errcode = '23514'; end if;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id = p_parcela_id and chamado_id = p_chamado_id for update;
  if not found or v_parcela.situacao <> 'pendente' then raise exception 'parcela_indisponivel' using errcode = '23514'; end if;
  insert into pcm.sso_backlog_composicoes(cliente_id, alvo_tipo, alvo_id, criado_por)
    values (p_cliente_id, p_alvo_tipo, p_alvo_id, v_ator) returning id into v_composicao_id;
  insert into pcm.sso_backlog_parcelas(pendencia_id, parcela_id, composicao_id, chamado_id, cliente_id, ator_id, request_id, payload, origem)
    values (null, p_parcela_id, v_composicao_id, p_chamado_id, p_cliente_id, v_ator, p_request_id, v_payload, 'chamado_devolvido')
    returning id into v_backlog_id;
  v_resultado := jsonb_build_object('requestId', p_request_id, 'chamadoId', p_chamado_id, 'parcelaId', p_parcela_id,
    'backlogParcelaId', v_backlog_id, 'composicaoId', v_composicao_id);
  insert into pcm.sso_devolucoes_escopo_chamado(request_id, ator_id, cliente_id, chamado_id, parcela_id, backlog_parcela_id, payload, resultado)
    values (p_request_id, v_ator, p_cliente_id, p_chamado_id, p_parcela_id, v_backlog_id, v_payload, v_resultado);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'chamado.escopo_devolvido_backlog', 'chamado_escopo_parcelas', p_parcela_id, v_resultado || jsonb_build_object('motivo', v_motivo));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_devolver_parcela_chamado_backlog(uuid, uuid, uuid, uuid, text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_devolver_parcela_chamado_backlog(uuid, uuid, uuid, uuid, text, uuid, text) to authenticated;
