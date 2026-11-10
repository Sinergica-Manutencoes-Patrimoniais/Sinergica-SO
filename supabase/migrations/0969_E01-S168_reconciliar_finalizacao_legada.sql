-- ADR-0760: leitura de resultado já gravado; ausência não autoriza reenvio automático.
create function pcm.sso_consultar_finalizacao_os_por_pedido(
  p_request_id uuid, p_cliente_id uuid, p_retorno_id uuid, p_atestacao_request_id uuid,
  p_expected_decisao integer, p_expected_status text, p_expected_updated_at timestamptz
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_registro pcm.sso_finalizacoes_os_validadas%rowtype;
  v_payload jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_finalizar_os_validada_gate where id), false)
     or not coalesce((select habilitado from pcm.sso_atestacao_pcm_gate where id), false) then
    raise exception 'finalizacao_os_bloqueada' using errcode = '55000';
  end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null
     or p_atestacao_request_id is null or p_expected_decisao is null or p_expected_decisao < 1
     or p_expected_status is null or p_expected_updated_at is null then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('execucao.validar', p_cliente_id) is distinct from true
     or not exists (select 1 from pcm.retorno_os_preparado r
       where r.id = p_retorno_id and r.cliente_id = p_cliente_id) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('clienteId', p_cliente_id, 'retornoId', p_retorno_id,
    'atestacaoRequestId', p_atestacao_request_id, 'expectedDecisao', p_expected_decisao,
    'expectedStatus', p_expected_status, 'expectedUpdatedAt', p_expected_updated_at);
  select * into v_registro from pcm.sso_finalizacoes_os_validadas where request_id = p_request_id;
  if not found then
    return jsonb_build_object('situacao', 'nao_localizada', 'requestId', p_request_id);
  end if;
  if v_registro.ator_id is distinct from v_ator or v_registro.payload is distinct from v_payload
     or v_registro.retorno_id is distinct from p_retorno_id then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return jsonb_build_object('situacao', 'encontrada', 'requestId', p_request_id,
    'resultado', v_registro.resultado);
end;
$$;
revoke all on function pcm.sso_consultar_finalizacao_os_por_pedido(uuid,uuid,uuid,uuid,integer,text,timestamptz)
  from public, anon, authenticated, service_role;

-- Validar o alvo na mesma transação e antes de qualquer transição da OS.
create function pcm.sso_finalizar_os_validada_v2(
  p_request_id uuid, p_cliente_id uuid, p_retorno_id uuid, p_expected_os_id uuid,
  p_atestacao_request_id uuid, p_expected_decisao integer, p_expected_status text,
  p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_os_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_finalizar_os_validada_gate where id), false)
     or not coalesce((select habilitado from pcm.sso_atestacao_pcm_gate where id), false) then
    raise exception 'finalizacao_os_bloqueada' using errcode = '55000';
  end if;
  if p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_expected_os_id is null then
    raise exception 'finalizacao_invalida' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select r.os_id into v_os_id from pcm.retorno_os_preparado r
    where r.id = p_retorno_id and r.cliente_id = p_cliente_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if v_os_id is distinct from p_expected_os_id then
    raise exception 'os_divergente' using errcode = '40001';
  end if;
  return pcm.sso_finalizar_os_validada(p_request_id, p_cliente_id, p_retorno_id,
    p_atestacao_request_id, p_expected_decisao, p_expected_status, p_expected_updated_at);
end;
$$;
revoke all on function pcm.sso_finalizar_os_validada_v2(uuid,uuid,uuid,uuid,uuid,integer,text,timestamptz)
  from public, anon, authenticated, service_role;
