-- ADR-0883: identidade local conferida é precondição, não prova de estado remoto.
create function pcm.sso_consultar_identidade_transferencia(p_cliente_id uuid,p_origem_id uuid,p_vinculo_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_os_id uuid; v_tarefa bigint;
begin
  perform pcm.sso_exigir_intencao_os_mediada();
  if auth.uid() is null or p_cliente_id is null or p_origem_id is null or p_vinculo_id is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  select o.id,o.auvo_task_id into v_os_id,v_tarefa
    from pcm.visitas v join pcm.visita_ordens_servico vo on vo.visita_id=v.id and vo.cliente_id=v.cliente_id and vo.encerrado_em is null
    join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id and o.deleted_at is null
    where v.id=p_origem_id and v.cliente_id=p_cliente_id and vo.id=p_vinculo_id;
  if v_os_id is null or v_tarefa is null or v_tarefa<=0 then raise exception 'tarefa_auvo_nao_identificada' using errcode='23514'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'origemId',p_origem_id,'vinculoId',p_vinculo_id,'osId',v_os_id,'tarefaAuvoId',v_tarefa::text);
end;
$$;
revoke all on function pcm.sso_consultar_identidade_transferencia(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_identidade_transferencia(uuid,uuid,uuid) to authenticated;

create function pcm.sso_transferir_os_enviada_conferida(
  p_request_id uuid,p_intencao_id uuid,p_origem_id uuid,p_destino_id uuid,p_vinculo_id uuid,p_novo_vinculo_id uuid,
  p_revisao_origem integer,p_revisao_destino integer,p_sequencia integer,p_motivo text,p_tarefa_esperada text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_comando pcm.visita_comandos%rowtype; v_cliente uuid; v_os_id uuid; v_tarefa bigint;
begin
  perform pcm.sso_exigir_intencao_os_mediada();
  if not coalesce((select g.habilitado from pcm.transferencia_visita_gate g where g.id),false) then raise exception 'transferencia_bloqueada' using errcode='55000'; end if;
  perform 1 from pcm.transferencia_visita_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.transferencia_visita_gate g where g.id),false) then raise exception 'transferencia_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_origem_id is null or p_destino_id is null or p_vinculo_id is null
    or p_tarefa_esperada is null or p_tarefa_esperada !~ '^[1-9][0-9]{0,18}$' then raise exception 'transferencia_invalida' using errcode='22023'; end if;
  perform pcm.sso_lock_transferencia_composicao(p_request_id,p_origem_id,p_destino_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
  select * into v_comando from pcm.visita_comandos where request_id=p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or config.sso_autorizar_acao('visita.confirmar',v_comando.cliente_id) is distinct from true then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
    if v_comando.resultado->>'tarefaAuvoId' is distinct from p_tarefa_esperada then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  else
    perform v.id from pcm.visitas v where v.id in (p_origem_id,p_destino_id) order by v.id for update;
    select cliente_id into v_cliente from pcm.visitas where id=p_origem_id;
    if v_cliente is null or config.sso_autorizar_acao('visita.confirmar',v_cliente) is distinct from true then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
    select vo.os_id into v_os_id from pcm.visita_ordens_servico vo where vo.id=p_vinculo_id and vo.visita_id=p_origem_id
      and vo.cliente_id=v_cliente and vo.encerrado_em is null for update;
    if v_os_id is null then raise exception 'vinculo_nao_disponivel' using errcode='23514'; end if;
    select o.auvo_task_id into v_tarefa from pcm.ordens_servico o where o.id=v_os_id and o.client_id=v_cliente and o.deleted_at is null for update;
    if v_tarefa is null or v_tarefa::text is distinct from p_tarefa_esperada then raise exception 'identidade_tarefa_alterada' using errcode='40001'; end if;
  end if;
  return pcm.sso_transferir_os_enviada_mediada(p_request_id,p_intencao_id,p_origem_id,p_destino_id,p_vinculo_id,p_novo_vinculo_id,
    p_revisao_origem,p_revisao_destino,p_sequencia,p_motivo);
end;
$$;
revoke all on function pcm.sso_transferir_os_enviada_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_transferir_os_enviada_conferida(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_transferir_os_enviada_conferida(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,text) to authenticated;
