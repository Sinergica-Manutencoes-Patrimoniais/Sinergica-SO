-- ADR-0125: transferência fechada, apenas Visitas não confirmadas; sem rede.
create table pcm.transferencia_visita_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
alter table pcm.transferencia_visita_gate enable row level security;
alter table pcm.transferencia_visita_gate force row level security;
revoke all on pcm.transferencia_visita_gate from public, anon, authenticated, service_role;
insert into pcm.transferencia_visita_gate(id, habilitado) values(true, false);

create function pcm.sso_transferir_os_visita_preparado(
  p_request_id uuid, p_origem_id uuid, p_destino_id uuid, p_vinculo_id uuid, p_novo_vinculo_id uuid,
  p_revisao_origem integer, p_revisao_destino integer, p_sequencia integer, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_origem pcm.visitas%rowtype; v_destino pcm.visitas%rowtype;
  v_vinculo pcm.visita_ordens_servico%rowtype; v_comando pcm.visita_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not coalesce((select habilitado from pcm.transferencia_visita_gate where id), false) then
    raise exception 'transferencia_bloqueada' using errcode = '55000'; end if;
  if v_actor is null or p_request_id is null or p_origem_id is null or p_destino_id is null
    or p_origem_id = p_destino_id or p_vinculo_id is null or p_novo_vinculo_id is null
    or p_revisao_origem is null or p_revisao_destino is null or p_revisao_origem < 1 or p_revisao_destino < 1
    or p_sequencia is null or p_sequencia < 1 or v_motivo is null or length(v_motivo) > 2000 then
    raise exception 'transferencia_invalida' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('tipo', 'transferirOsVisita', 'origemId', p_origem_id,
    'destinoId', p_destino_id, 'vinculoId', p_vinculo_id, 'novoVinculoId', p_novo_vinculo_id,
    'revisaoOrigem', p_revisao_origem, 'revisaoDestino', p_revisao_destino,
    'sequencia', p_sequencia, 'motivo', v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor
      or config.sso_autorizar_acao('visita.confirmar', v_comando.cliente_id) is distinct from true then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  perform id from pcm.visitas where id in (p_origem_id, p_destino_id) order by id for update;
  select * into v_origem from pcm.visitas where id = p_origem_id;
  select * into v_destino from pcm.visitas where id = p_destino_id;
  if v_origem.id is null or v_destino.id is null or v_origem.cliente_id is distinct from v_destino.cliente_id
    or config.sso_autorizar_acao('visita.confirmar', v_origem.cliente_id) is distinct from true then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if v_origem.revisao <> p_revisao_origem or v_destino.revisao <> p_revisao_destino then
    raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_origem.estado not in ('rascunho', 'planejada') or v_destino.estado not in ('rascunho', 'planejada') then
    raise exception 'visita_nao_editavel' using errcode = '23514'; end if;
  select * into v_vinculo from pcm.visita_ordens_servico where id = p_vinculo_id
    and visita_id = p_origem_id and cliente_id = v_origem.cliente_id and encerrado_em is null for update;
  if not found then raise exception 'vinculo_nao_disponivel' using errcode = '23514'; end if;
  perform 1 from pcm.ordens_servico o where o.id = v_vinculo.os_id and o.client_id = v_origem.cliente_id
    and o.deleted_at is null and o.status not in ('finalizado', 'cancelado') for share;
  if not found then raise exception 'os_nao_elegivel' using errcode = '23514'; end if;
  update pcm.visita_ordens_servico set encerrado_em = now(), encerrado_por = v_actor, encerramento_motivo = v_motivo
    where id = p_vinculo_id;
  insert into pcm.visita_ordens_servico(id, visita_id, os_id, cliente_id, sequencia, estimativa_minutos, created_by)
    values (p_novo_vinculo_id, p_destino_id, v_vinculo.os_id, v_origem.cliente_id,
      p_sequencia, v_vinculo.estimativa_minutos, v_actor);
  update pcm.visitas set revisao = revisao + 1, updated_at = now(), updated_by = v_actor where id in (p_origem_id, p_destino_id);
  v_resultado := jsonb_build_object('origemId', p_origem_id, 'destinoId', p_destino_id,
    'osId', v_vinculo.os_id, 'novoVinculoId', p_novo_vinculo_id, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'visita.os_transferida', 'visitas', p_origem_id, v_resultado || jsonb_build_object('motivo', v_motivo));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_origem.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_transferir_os_visita_preparado(uuid, uuid, uuid, uuid, uuid, integer, integer, integer, text)
  from public, anon, authenticated, service_role;
