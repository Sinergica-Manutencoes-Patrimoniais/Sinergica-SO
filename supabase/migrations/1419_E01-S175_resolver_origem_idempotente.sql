-- ADR-1271: fronteira privada; não habilita inbox ou cria OS.
create function pcm.sso_resolver_envelope_origem_idempotente(p_envelope_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_env pcm.origem_campo_inbox%rowtype;
  v_ultima pcm.origem_campo_resolucoes%rowtype;
  v_cliente uuid; v_os uuid; v_cliente_os uuid; v_estado text;
begin
  if coalesce(auth.role(),'') <> 'service_role' or p_envelope_id is null then
    raise exception 'servico_nao_autorizado' using errcode='42501';
  end if;
  perform 1 from pcm.origem_campo_inbox_gate where id and habilitado for share;
  if not found then raise exception 'inbox_origem_campo_bloqueada' using errcode='55000'; end if;
  select * into v_env from pcm.origem_campo_inbox where id=p_envelope_id for update;
  if not found or v_env.integracao <> 'auvo' then raise exception 'envelope_indisponivel' using errcode='22023'; end if;
  select c.id into v_cliente from pcm.clientes c where c.auvo_id::text=v_env.cliente_externo_id and c.deleted_at is null;
  if v_cliente is null then v_estado:='cliente_desconhecido';
  else
    select o.id,o.client_id into v_os,v_cliente_os from pcm.ordens_servico o where o.auvo_task_id=v_env.task_id and o.deleted_at is null;
    if v_os is null then v_estado:='os_nao_encontrada';
    elsif v_cliente_os is distinct from v_cliente then v_estado:='cliente_divergente'; v_os:=null;
    else v_estado:='os_identificada'; end if;
  end if;
  select * into v_ultima from pcm.origem_campo_resolucoes where envelope_id=p_envelope_id order by criada_em desc,id desc limit 1;
  if found and v_ultima.resultado=v_estado and v_ultima.cliente_id is not distinct from v_cliente and v_ultima.os_id is not distinct from v_os then
    return jsonb_build_object('resolucaoId',v_ultima.id,'envelopeId',p_envelope_id,'resultado',v_estado,
      'clienteId',v_cliente,'osId',v_os,'eventoAplicado',false,'reutilizada',true);
  end if;
  return pcm.sso_resolver_envelope_origem_campo(p_envelope_id) || jsonb_build_object('reutilizada',false);
end; $$;
revoke all on function pcm.sso_resolver_envelope_origem_idempotente(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resolver_envelope_origem_idempotente(uuid) to service_role;
