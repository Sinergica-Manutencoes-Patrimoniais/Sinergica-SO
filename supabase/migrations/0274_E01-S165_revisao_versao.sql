-- ADR-0050: revisão preparatória de Plano aprovado, sem gerar execução.
create function pcm.sso_iniciar_revisao_plano(p_request_id uuid, p_expected_revision integer, p_plano_id uuid, p_nova_versao_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_antes pcm.planos_manutencao%rowtype; v_plano pcm.planos_manutencao%rowtype;
  v_origem pcm.plano_versoes%rowtype; v_comando pcm.plano_comandos%rowtype; v_item record;
  v_payload jsonb; v_resultado jsonb; v_ids jsonb; v_novo_id uuid;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1 or p_plano_id is null or p_nova_versao_id is null then
    raise exception 'revisao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'iniciarRevisaoPlano', 'expectedRevision', p_expected_revision,
    'planoId', p_plano_id, 'novaVersaoId', p_nova_versao_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:' || p_request_id::text, 0));
  select * into v_antes from pcm.planos_manutencao where id = p_plano_id for update;
  if not found or not config.sso_autorizar_acao('plano.gerir', v_antes.cliente_id) then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.plano_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_antes.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_antes.estado <> 'aprovado' or exists(select 1 from pcm.plano_versoes where plano_id = p_plano_id and estado = 'rascunho') then
    raise exception 'estado_incompativel' using errcode = '22023';
  end if;
  select * into v_origem from pcm.plano_versoes where plano_id = p_plano_id and estado = 'aprovado' order by numero desc limit 1 for update;
  if not found or jsonb_typeof(v_origem.snapshot->'rotinas') is distinct from 'array'
    or jsonb_array_length(v_origem.snapshot->'rotinas') = 0 then
    raise exception 'snapshot_historico_indisponivel' using errcode = '23514';
  end if;
  insert into pcm.plano_versoes(id, plano_id, numero, created_by)
    values (p_nova_versao_id, p_plano_id, v_origem.numero + 1, v_actor);
  v_ids := jsonb_build_object('clienteId', v_antes.cliente_id, 'versaoId', p_nova_versao_id, 'versaoOrigemId', v_origem.id);
  for v_item in select * from jsonb_to_recordset(v_origem.snapshot->'rotinas') as r(
    rotina_logica_id uuid, nome text, alvo_tipo text, sistema_id uuid, equipamento_id uuid, grupo_id uuid,
    modo text, intervalo_n integer, intervalo_unidade text, data_base date, tempo_minutos integer, tipo_tempo text,
    tolerancia_antes integer, tolerancia_depois integer, instrucao text, questionario_id uuid) loop
    v_novo_id := gen_random_uuid();
    insert into pcm.rotinas_manutencao(id, rotina_logica_id, plano_id, versao_id, nome, alvo_tipo, sistema_id, equipamento_id,
      grupo_id, modo, intervalo_n, intervalo_unidade, data_base, tempo_minutos, tipo_tempo, tolerancia_antes, tolerancia_depois,
      instrucao, questionario_id, created_by)
    values (v_novo_id, v_item.rotina_logica_id, p_plano_id, p_nova_versao_id, v_item.nome, v_item.alvo_tipo,
      v_item.sistema_id, v_item.equipamento_id, v_item.grupo_id, v_item.modo, v_item.intervalo_n, v_item.intervalo_unidade,
      v_item.data_base, v_item.tempo_minutos, v_item.tipo_tempo, v_item.tolerancia_antes, v_item.tolerancia_depois,
      v_item.instrucao, v_item.questionario_id, v_actor);
    v_ids := v_ids || jsonb_build_object('rotina:' || v_item.rotina_logica_id::text, v_novo_id);
  end loop;
  update pcm.planos_manutencao set estado = 'rascunho', revisao = revisao + 1, updated_at = now(), updated_by = v_actor
    where id = p_plano_id returning * into v_plano;
  v_resultado := jsonb_build_object('aggregateId', p_plano_id, 'revision', v_plano.revisao, 'state', v_plano.estado,
    'created', true, 'linkedIds', v_ids, 'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'plano.revisao_iniciada', 'planos_manutencao', p_plano_id,
      jsonb_build_object('requestId', p_request_id, 'origem', v_origem.id, 'versaoId', p_nova_versao_id,
        'antes', to_jsonb(v_antes), 'depois', to_jsonb(v_plano)));
  insert into pcm.plano_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_plano.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_iniciar_revisao_plano(uuid, integer, uuid, uuid) from public, anon;
grant execute on function pcm.sso_iniciar_revisao_plano(uuid, integer, uuid, uuid) to authenticated;

-- Nenhuma segunda versão é aprovada até a implementação das vigências não sobrepostas.
create function pcm.sso_bloquear_aprovacao_sem_vigencia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.estado = 'rascunho' and new.estado = 'aprovado'
    and exists(select 1 from pcm.plano_versoes v where v.plano_id = old.plano_id and v.estado = 'aprovado' and v.id <> old.id) then
    raise exception 'revisao_sem_vigencia_segura' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_bloquear_aprovacao_sem_vigencia() from public, anon, authenticated, service_role;
create trigger sso_bloquear_aprovacao_sem_vigencia before update of estado on pcm.plano_versoes
for each row execute function pcm.sso_bloquear_aprovacao_sem_vigencia();
