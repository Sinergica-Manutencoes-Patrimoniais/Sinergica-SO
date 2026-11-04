-- E01-S170: motivo obrigatório e parte do comando e do evento auditável.
-- Reverso exige restaurar o grant da assinatura sem motivo, enfraquecendo a auditoria.
revoke execute on function config.sso_definir_concessao(uuid, integer, uuid, uuid, text, uuid, boolean)
  from public, anon, authenticated, service_role;

create or replace function config.sso_definir_concessao(
  p_request_id uuid, p_expected_revision integer, p_usuario_id uuid, p_perfil_id uuid,
  p_acao text, p_cliente_id uuid, p_ativa boolean, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_motivo text := nullif(btrim(p_motivo), '');
  v_payload jsonb;
  v_anterior config.sso_concessoes%rowtype;
  v_atual config.sso_concessoes%rowtype;
  v_comando config.sso_comandos%rowtype;
  v_resultado jsonb;
begin
  if not exists (select 1 from config.usuarios u where u.user_id = v_actor
    and u.ativo and u.papel = 'superadmin' and auth.jwt() ->> 'user_role' = 'superadmin') then
    raise exception 'sem_permissao_para_conceder' using errcode = '42501';
  end if;
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 0
     or p_ativa is null or p_acao is null or v_motivo is null or length(v_motivo) > 1000
     or ((p_usuario_id is null) = (p_perfil_id is null)) then
    raise exception 'concessao_invalida' using errcode = '22023';
  end if;
  if not exists (select 1 from config.sso_acoes a where a.codigo = p_acao) then
    raise exception 'acao_invalida' using errcode = '22023';
  end if;
  if p_perfil_id is not null and exists (select 1 from config.sso_acoes a
    where a.codigo = p_acao and a.exige_concessao_individual) then
    raise exception 'acao_exige_concessao_individual' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('usuarioId', p_usuario_id, 'perfilId', p_perfil_id,
    'acao', p_acao, 'clienteId', p_cliente_id, 'ativa', p_ativa,
    'expectedRevision', p_expected_revision, 'motivo', v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_comando from config.sso_comandos c where c.request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    concat_ws(':', 'sso_concessao', coalesce(p_usuario_id::text, '-'),
      coalesce(p_perfil_id::text, '-'), p_acao, coalesce(p_cliente_id::text, '-')), 0));
  select * into v_anterior from config.sso_concessoes g
    where g.usuario_id is not distinct from p_usuario_id and g.perfil_id is not distinct from p_perfil_id
      and g.acao = p_acao and g.cliente_id is not distinct from p_cliente_id for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    if not p_ativa then raise exception 'concessao_inexistente' using errcode = '22023'; end if;
    insert into config.sso_concessoes (usuario_id, perfil_id, acao, cliente_id, ativa, revisao)
      values (p_usuario_id, p_perfil_id, p_acao, p_cliente_id, p_ativa, 1) returning * into v_atual;
  else
    if v_anterior.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    update config.sso_concessoes set ativa = p_ativa, revisao = revisao + 1
      where id = v_anterior.id returning * into v_atual;
  end if;
  v_resultado := jsonb_build_object('aggregateId', v_atual.id, 'revision', v_atual.revisao,
    'state', v_atual.ativa, 'created', v_anterior.id is null,
    'linkedIds', jsonb_build_object(), 'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, case when p_ativa then 'capacidade.concedida' else 'capacidade.revogada' end,
      'sso_concessoes', v_atual.id, jsonb_build_object('requestId', p_request_id, 'motivo', v_motivo,
        'antes', case when v_anterior.id is null then null else to_jsonb(v_anterior) end,
        'depois', to_jsonb(v_atual)));
  insert into config.sso_comandos(request_id, actor_id, payload, resultado)
    values (p_request_id, v_actor, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function config.sso_definir_concessao(uuid, integer, uuid, uuid, text, uuid, boolean, text) from public, anon;
grant execute on function config.sso_definir_concessao(uuid, integer, uuid, uuid, text, uuid, boolean, text) to authenticated;
