-- ADR-0832: preserva gate, ACL e verificação da transição legada.
create or replace function pcm.sso_criar_os_chamado(
  p_request_id uuid, p_expected_revision bigint, p_chamado_id uuid,
  p_cliente_id uuid, p_os_id uuid, p_titulo text, p_descricao text, p_categoria text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_chamado pcm.chamados%rowtype;
  v_comando pcm.chamado_os_comandos%rowtype;
  v_payload jsonb;
  v_resultado jsonb;
  v_numero text;
  v_sync_anterior text;
begin
  if not coalesce((select habilitado from pcm.chamado_os_gate where id), false) then
    raise exception 'criacao_multipla_bloqueada' using errcode = '55000';
  end if;
  if pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado') is not null
    or exists (select 1 from pg_catalog.pg_trigger t
      where t.tgrelid = 'pcm.ordens_servico'::regclass
        and t.tgname = 'trg_ordens_servico_numero_chamado' and not t.tgisinternal) then
    raise exception 'transicao_legada_incompleta' using errcode = '55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  if v_actor is null or p_request_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_chamado_id is null or p_cliente_id is null or p_os_id is null
    or p_titulo is null or length(btrim(p_titulo)) not between 1 and 200
    or p_categoria is null or p_categoria not in ('preventiva', 'corretiva', 'emergencial') then
    raise exception 'comando_invalido' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('chamadoId', p_chamado_id, 'clienteId', p_cliente_id,
    'expectedRevision', p_expected_revision, 'osId', p_os_id, 'titulo', btrim(p_titulo),
    'descricao', p_descricao, 'categoria', p_categoria);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-os-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.chamado_os_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor
      or not config.sso_autorizar_acao('chamado.os.criar', v_comando.cliente_id) then
      raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  select * into v_chamado from pcm.chamados where id = p_chamado_id for update;
  if not found or v_chamado.deleted_at is not null or v_chamado.cliente_id is distinct from p_cliente_id
    or not config.sso_autorizar_acao('chamado.os.criar', p_cliente_id) then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if v_chamado.sso_revisao <> p_expected_revision then
    raise exception 'revisao_obsoleta' using errcode = '40001';
  end if;
  if v_chamado.status not in ('aberto', 'convertido_os') then
    raise exception 'chamado_nao_editavel' using errcode = '23514';
  end if;
  v_numero := v_chamado.numero || '-OS-' || p_os_id::text;
  v_sync_anterior := current_setting('app.auvo_sync_write', true);
  perform set_config('app.auvo_sync_write', 'true', true);
  insert into pcm.ordens_servico(id, client_id, chamado_id, numero, titulo, descricao, categoria, status, origem, created_by)
    values (p_os_id, p_cliente_id, p_chamado_id, v_numero, btrim(p_titulo), p_descricao,
      p_categoria, 'solicitacao', 'manual', v_actor);
  perform set_config('app.auvo_sync_write', coalesce(v_sync_anterior, ''), true);
  update pcm.chamados set ordem_servico_id = coalesce(ordem_servico_id, p_os_id),
    status = 'convertido_os', updated_at = now(), updated_by = v_actor
    where id = p_chamado_id returning * into v_chamado;
  insert into pcm.chamados_eventos(chamado_id, tipo, metadata, created_by)
    values (p_chamado_id, 'os_gerada', jsonb_build_object('ordemServicoId', p_os_id, 'requestId', p_request_id), v_actor);
  v_resultado := jsonb_build_object('chamadoId', p_chamado_id, 'osId', p_os_id,
    'numero', v_numero, 'revision', v_chamado.sso_revisao, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'chamado.os_criada', 'chamados', p_chamado_id, v_resultado);
  insert into pcm.chamado_os_comandos(request_id, actor_id, cliente_id, chamado_id, payload, resultado)
    values (p_request_id, v_actor, p_cliente_id, p_chamado_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;

