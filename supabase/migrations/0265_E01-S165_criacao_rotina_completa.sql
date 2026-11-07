-- ADR-0043: criação completa com compatibilidade da assinatura anterior.
create function pcm.sso_adicionar_rotina_rascunho_interno(p_request_id uuid, p_expected_revision integer,
  p_plano_id uuid, p_rotina_id uuid, p_nome text, p_alvo_tipo text, p_alvo_id uuid,
  p_modo text, p_intervalo integer, p_unidade text, p_data_base date, p_tempo_minutos integer,
  p_tolerancia_antes integer, p_tolerancia_depois integer, p_instrucao text, p_questionario_id uuid, p_tipo_tempo text, p_legado boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_plano pcm.planos_manutencao%rowtype; v_versao uuid; v_cliente_alvo uuid;
  v_comando pcm.plano_comandos%rowtype; v_payload jsonb; v_resultado jsonb; v_rotina pcm.rotinas_manutencao%rowtype;
  v_nome text := nullif(btrim(p_nome), ''); v_instrucao text := nullif(btrim(p_instrucao), '');
  v_antes integer := coalesce(p_tolerancia_antes, 0); v_depois integer := coalesce(p_tolerancia_depois, 0);
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1 or p_plano_id is null or p_rotina_id is null
    or v_nome is null or length(v_nome) > 200 or p_alvo_tipo is null or p_alvo_tipo not in ('sistema', 'componente', 'grupo')
    or p_alvo_id is null or p_modo is null or p_modo not in ('calendario', 'visita')
    or (p_intervalo is null) <> (p_unidade is null) or (p_intervalo is not null and p_intervalo < 1)
    or (p_unidade is not null and p_unidade not in ('dias', 'semanas', 'meses', 'anos'))
    or (p_tempo_minutos is not null and p_tempo_minutos < 0) or v_antes < 0 or v_depois < 0
    or length(v_instrucao) > 10000 or (p_tipo_tempo is not null and p_tipo_tempo not in ('total', 'por_unidade')) then raise exception 'rotina_invalida' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('tipo', 'adicionarRotina', 'expectedRevision', p_expected_revision,
    'planoId', p_plano_id, 'rotinaId', p_rotina_id, 'nome', v_nome, 'alvoTipo', p_alvo_tipo, 'alvoId', p_alvo_id,
    'modo', p_modo, 'intervalo', p_intervalo, 'unidade', p_unidade, 'dataBase', p_data_base, 'tempoMinutos', p_tempo_minutos);
  if not p_legado then v_payload := v_payload || jsonb_build_object('toleranciaAntes', v_antes, 'toleranciaDepois', v_depois, 'instrucao', v_instrucao, 'questionarioId', p_questionario_id, 'tipoTempo', p_tipo_tempo); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:' || p_request_id::text, 0));
  select * into v_plano from pcm.planos_manutencao where id = p_plano_id for update;
  if not found or not config.sso_autorizar_acao('plano.gerir', v_plano.cliente_id) then
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
  if v_plano.estado <> 'rascunho' then raise exception 'plano_nao_editavel' using errcode = '22023'; end if;
  if v_plano.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if p_alvo_tipo = 'sistema' then
    select s.cliente_id into v_cliente_alvo from pcm.sistemas s where s.id = p_alvo_id and s.ativo and s.deleted_at is null for share;
  elsif p_alvo_tipo = 'componente' then
    select e.client_id into v_cliente_alvo from pcm.equipamentos e where e.id = p_alvo_id and e.ativo and e.deleted_at is null for share;
  else
    select g.cliente_id into v_cliente_alvo from pcm.grupos_quantitativos g where g.id = p_alvo_id and g.ativo and g.deleted_at is null for share;
  end if;
  if v_cliente_alvo is distinct from v_plano.cliente_id then raise exception 'alvo_invalido_ou_de_outro_cliente' using errcode = '23514'; end if;
  if p_questionario_id is not null then
    perform 1 from pcm.questionarios q where q.id = p_questionario_id and q.ativo for share;
    if not found then raise exception 'questionario_indisponivel' using errcode = '22023'; end if;
  end if;
  select id into v_versao from pcm.plano_versoes where plano_id = p_plano_id and estado = 'rascunho';
  if v_versao is null then
    insert into pcm.plano_versoes(plano_id, numero, created_by) values (p_plano_id, 1, v_actor) returning id into v_versao;
  end if;
  insert into pcm.rotinas_manutencao(id, rotina_logica_id, plano_id, versao_id, nome, alvo_tipo,
    sistema_id, equipamento_id, grupo_id, modo, intervalo_n, intervalo_unidade, data_base, tempo_minutos, tolerancia_antes, tolerancia_depois, instrucao, questionario_id, tipo_tempo, created_by)
    values (p_rotina_id, p_rotina_id, p_plano_id, v_versao, v_nome, p_alvo_tipo,
      case when p_alvo_tipo = 'sistema' then p_alvo_id end, case when p_alvo_tipo = 'componente' then p_alvo_id end,
      case when p_alvo_tipo = 'grupo' then p_alvo_id end, p_modo, p_intervalo, p_unidade, p_data_base, p_tempo_minutos, v_antes, v_depois, v_instrucao, p_questionario_id, p_tipo_tempo, v_actor)
    returning * into v_rotina;
  update pcm.planos_manutencao set revisao = revisao + 1, updated_at = now(), updated_by = v_actor where id = p_plano_id returning * into v_plano;
  v_resultado := jsonb_build_object('aggregateId', p_plano_id, 'revision', v_plano.revisao, 'state', v_plano.estado,
    'created', true, 'linkedIds', jsonb_build_object('clienteId', v_plano.cliente_id, 'versaoId', v_versao, 'rotinaId', p_rotina_id),
    'warnings', case when coalesce(p_tempo_minutos, 0) = 0 then jsonb_build_array('tempo_a_validar') when p_tipo_tempo is null then jsonb_build_array('tipo_tempo_a_validar') else jsonb_build_array() end,
    'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'rotina.rascunho_criada', 'rotinas_manutencao', p_rotina_id,
      jsonb_build_object('requestId', p_request_id, 'planoId', p_plano_id, 'revision', v_plano.revisao, 'depois', to_jsonb(v_rotina)));
  insert into pcm.plano_comandos(request_id, actor_id, cliente_id, payload, resultado) values (p_request_id, v_actor, v_plano.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;

revoke all on function pcm.sso_adicionar_rotina_rascunho_interno(uuid, integer, uuid, uuid, text, text, uuid, text, integer, text, date, integer, integer, integer, text, uuid, text, boolean) from public, anon, authenticated, service_role;

create or replace function pcm.sso_adicionar_rotina_rascunho(p_request_id uuid, p_expected_revision integer, p_plano_id uuid, p_rotina_id uuid, p_nome text, p_alvo_tipo text, p_alvo_id uuid, p_modo text, p_intervalo integer, p_unidade text, p_data_base date, p_tempo_minutos integer) returns jsonb language sql security definer set search_path = '' as $$
  select pcm.sso_adicionar_rotina_rascunho_interno(p_request_id, p_expected_revision, p_plano_id, p_rotina_id, p_nome, p_alvo_tipo, p_alvo_id, p_modo, p_intervalo, p_unidade, p_data_base, p_tempo_minutos, 0, 0, null, null, null, true);
$$;

create function pcm.sso_adicionar_rotina_rascunho_v2(p_request_id uuid, p_expected_revision integer, p_plano_id uuid, p_rotina_id uuid, p_nome text, p_alvo_tipo text, p_alvo_id uuid, p_modo text, p_intervalo integer, p_unidade text, p_data_base date, p_tempo_minutos integer, p_tolerancia_antes integer, p_tolerancia_depois integer, p_instrucao text, p_questionario_id uuid, p_tipo_tempo text) returns jsonb language sql security definer set search_path = '' as $$
  select pcm.sso_adicionar_rotina_rascunho_interno(p_request_id, p_expected_revision, p_plano_id, p_rotina_id, p_nome, p_alvo_tipo, p_alvo_id, p_modo, p_intervalo, p_unidade, p_data_base, p_tempo_minutos, p_tolerancia_antes, p_tolerancia_depois, p_instrucao, p_questionario_id, p_tipo_tempo, false);
$$;
revoke all on function pcm.sso_adicionar_rotina_rascunho_v2(uuid, integer, uuid, uuid, text, text, uuid, text, integer, text, date, integer, integer, integer, text, uuid, text) from public, anon;
grant execute on function pcm.sso_adicionar_rotina_rascunho_v2(uuid, integer, uuid, uuid, text, text, uuid, text, integer, text, date, integer, integer, integer, text, uuid, text) to authenticated;
