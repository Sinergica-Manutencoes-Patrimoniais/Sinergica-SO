-- ADR-1338: valida a fotografia sem substituir o comando idempotente existente.
create function pcm.sso_decidir_feriado_conferido(
  p_request_id uuid, p_cliente_id uuid, p_preparada_id uuid, p_feriado_id uuid,
  p_expected_revision integer, p_motivo text, p_feriado_revision integer, p_vencimento date
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_resultado jsonb; v_feriado pcm.feriados_declarados%rowtype;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null
    or p_feriado_id is null or p_feriado_revision is null or p_feriado_revision < 0
    or p_vencimento is null or not pg_catalog.isfinite(p_vencimento) then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  -- A mesma trava usada pelo núcleo impede que duas chamadas do pedido se ultrapassem.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-feriado-calendario:' || p_request_id::text, 0));
  if config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if not exists (select 1 from pcm.sso_decisoes_feriado_calendario where request_id = p_request_id) then
    -- Mesma ordem do núcleo: ocorrência antes de feriado.
    perform o.id from pcm.ocorrencias_rotina_preparadas o
      join pcm.planos_manutencao p on p.id = o.plano_id and p.cliente_id = p_cliente_id
      where o.id = p_preparada_id for update of o;
    if not found then raise exception 'ocorrencia_indisponivel' using errcode = '42501'; end if;
    select * into v_feriado from pcm.feriados_declarados
      where id = p_feriado_id and cliente_id = p_cliente_id and contrato_id is null and ativo for share;
    if not found or v_feriado.revisao is distinct from p_feriado_revision or v_feriado.data is distinct from p_vencimento then
      raise exception 'feriado_alterado' using errcode = '40001';
    end if;
  end if;
  v_resultado := pcm.sso_decidir_feriado_calendario(p_request_id, p_cliente_id, p_preparada_id,
    p_feriado_id, p_expected_revision, p_motivo);
  if (v_resultado->>'feriadoRevisao')::integer is distinct from p_feriado_revision
    or (v_resultado->>'vencimentoOriginal')::date is distinct from p_vencimento then
    raise exception 'fotografia_divergente' using errcode = '40001';
  end if;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_decidir_feriado_conferido(uuid,uuid,uuid,uuid,integer,text,integer,date) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_decidir_feriado_conferido(uuid,uuid,uuid,uuid,integer,text,integer,date) to authenticated;
