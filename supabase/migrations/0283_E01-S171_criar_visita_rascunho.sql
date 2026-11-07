-- ADR-0059: criação idempotente e auditada sem confirmação ou envio.
create table pcm.visita_comandos (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null,
  resultado jsonb not null,
  created_at timestamptz not null default now()
);
alter table pcm.visita_comandos enable row level security;
alter table pcm.visita_comandos force row level security;
revoke all on pcm.visita_comandos from public, anon, authenticated, service_role;

create function pcm.sso_criar_visita_rascunho(
  p_request_id uuid, p_expected_revision integer, p_visita_id uuid, p_cliente_id uuid,
  p_contrato_id uuid, p_area_id uuid, p_local_id uuid, p_inicio_em timestamptz, p_fim_em timestamptz,
  p_fuso text, p_natureza text, p_responsavel_id uuid, p_deslocamento_minutos integer
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_comando pcm.visita_comandos%rowtype; v_visita pcm.visitas%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 0 or p_visita_id is null
    or p_cliente_id is null or p_inicio_em is null or p_fim_em is null or not isfinite(p_inicio_em) or not isfinite(p_fim_em)
    or p_fim_em <= p_inicio_em or nullif(btrim(p_fuso), '') is null or p_natureza is null
    or p_natureza not in ('regular', 'extra', 'reposicao_manual') or p_deslocamento_minutos is null or p_deslocamento_minutos < 0 then
    raise exception 'visita_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'criarVisitaRascunho', 'expectedRevision', p_expected_revision,
    'visitaId', p_visita_id, 'clienteId', p_cliente_id, 'contratoId', p_contrato_id, 'areaId', p_area_id,
    'localId', p_local_id, 'inicioEm', p_inicio_em, 'fimEm', p_fim_em, 'fuso', p_fuso,
    'natureza', p_natureza, 'responsavelId', p_responsavel_id, 'deslocamentoMinutos', p_deslocamento_minutos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('visita.confirmar', v_comando.cliente_id) then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if p_responsavel_id is not null then
    perform 1 from pcm.funcionarios f where f.id = p_responsavel_id and f.ativo and f.deleted_at is null for share;
    if not found then raise exception 'responsavel_invalido' using errcode = '23514'; end if;
  end if;
  insert into pcm.visitas(id, cliente_id, contrato_id, area_id, local_id, inicio_em, fim_em, fuso, natureza,
    responsavel_id, deslocamento_minutos, created_by, updated_by)
    values (p_visita_id, p_cliente_id, p_contrato_id, p_area_id, p_local_id, p_inicio_em, p_fim_em, p_fuso,
      p_natureza, p_responsavel_id, p_deslocamento_minutos, v_actor, v_actor) returning * into v_visita;
  v_resultado := jsonb_build_object('aggregateId', v_visita.id, 'revision', v_visita.revisao, 'state', v_visita.estado,
    'created', true, 'linkedIds', jsonb_build_object('clienteId', v_visita.cliente_id),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'visita.rascunho_criado', 'visitas', p_visita_id, jsonb_build_object('requestId', p_request_id, 'depois', to_jsonb(v_visita)));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_visita.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_criar_visita_rascunho(uuid, integer, uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, uuid, integer) from public, anon;
grant execute on function pcm.sso_criar_visita_rascunho(uuid, integer, uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, uuid, integer) to authenticated;
