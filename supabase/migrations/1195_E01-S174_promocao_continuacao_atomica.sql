-- ADR-1044: mediador privado; ambas as operações participam da mesma transação.
create function pcm.sso_promover_e_registrar_continuacao_parcial(
  p_promocao_request_id uuid, p_registro_request_id uuid, p_ator_id uuid,
  p_cliente_id uuid, p_retorno_id uuid, p_retorno_revision integer,
  p_chamado_anterior_id uuid, p_chamado_anterior_revision bigint,
  p_chamado_id uuid, p_parcela_id uuid, p_ciclo_id uuid,
  p_titulo text, p_descricao text, p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_promocao jsonb; v_registro jsonb;
begin
  if auth.uid() is null or p_ator_id is distinct from auth.uid()
    or p_promocao_request_id is null or p_registro_request_id is null
    or p_promocao_request_id = p_registro_request_id or p_cliente_id is null
    or p_retorno_id is null or p_chamado_anterior_id is null
    or p_chamado_anterior_revision is null or p_chamado_anterior_revision < 1 then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;

  v_promocao := pcm.sso_promover_retorno_parcial(
    p_promocao_request_id,p_ator_id,p_cliente_id,p_retorno_id,p_retorno_revision,
    p_chamado_id,p_parcela_id,p_ciclo_id,p_titulo,p_descricao
  );
  if v_promocao->>'requestId' is distinct from p_promocao_request_id::text
    or v_promocao->>'clienteId' is distinct from p_cliente_id::text
    or v_promocao->>'retornoId' is distinct from p_retorno_id::text
    or v_promocao->>'chamadoAnteriorId' is distinct from p_chamado_anterior_id::text
    or v_promocao->>'chamadoId' is distinct from p_chamado_id::text
    or v_promocao->>'parcelaId' is distinct from p_parcela_id::text
    or v_promocao->>'cicloId' is distinct from p_ciclo_id::text then
    raise exception 'recibo_promocao_inconsistente' using errcode='23514';
  end if;

  v_registro := pcm.sso_registrar_continuacao_devolvida(
    p_ator_id,p_cliente_id,p_registro_request_id,p_retorno_id,p_chamado_anterior_revision,p_motivo
  );
  if v_registro->>'requestId' is distinct from p_registro_request_id::text
    or v_registro->>'clienteId' is distinct from p_cliente_id::text
    or v_registro->>'retornoId' is distinct from p_retorno_id::text
    or v_registro->>'chamadoId' is distinct from p_chamado_anterior_id::text
    or v_registro->>'situacao' is distinct from 'devolvida_backlog' then
    raise exception 'recibo_registro_inconsistente' using errcode='23514';
  end if;
  return jsonb_build_object('promocao',v_promocao,'registro',v_registro);
end;
$$;
revoke all on function pcm.sso_promover_e_registrar_continuacao_parcial(uuid,uuid,uuid,uuid,uuid,integer,uuid,bigint,uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
