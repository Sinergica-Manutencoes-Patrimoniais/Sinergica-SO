-- ADR-0054: criação idempotente e auditada, sem integração operacional.
create table pcm.calendario_contratual_comandos (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null,
  resultado jsonb not null,
  created_at timestamptz not null default now()
);
alter table pcm.calendario_contratual_comandos enable row level security;
alter table pcm.calendario_contratual_comandos force row level security;
revoke all on pcm.calendario_contratual_comandos from public, anon, authenticated, service_role;

create function pcm.sso_criar_regra_contratual(
  p_request_id uuid, p_expected_revision integer, p_serie_id uuid, p_regra_id uuid, p_contrato_id uuid,
  p_ancora_semana date, p_dia_semana integer, p_intervalo_semanas integer, p_hora_inicio time,
  p_duracao_minutos integer, p_deslocamento_minutos integer, p_fuso text, p_vigencia_inicio date, p_vigencia_fim date
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_cliente uuid; v_comando pcm.calendario_contratual_comandos%rowtype;
  v_regra pcm.regras_visita_contratual%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 0 or p_serie_id is null
    or p_regra_id is null or p_contrato_id is null or p_ancora_semana is null or p_dia_semana is null
    or p_intervalo_semanas is null or p_hora_inicio is null or p_hora_inicio >= '24:00'::time
    or p_duracao_minutos is null or p_deslocamento_minutos is null or nullif(btrim(p_fuso), '') is null
    or p_vigencia_inicio is null then raise exception 'regra_invalida' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('tipo', 'criarRegraContratual', 'expectedRevision', p_expected_revision,
    'serieId', p_serie_id, 'regraId', p_regra_id, 'contratoId', p_contrato_id, 'ancoraSemana', p_ancora_semana,
    'diaSemana', p_dia_semana, 'intervaloSemanas', p_intervalo_semanas, 'horaInicio', p_hora_inicio,
    'duracaoMinutos', p_duracao_minutos, 'deslocamentoMinutos', p_deslocamento_minutos, 'fuso', p_fuso,
    'vigenciaInicio', p_vigencia_inicio, 'vigenciaFim', p_vigencia_fim);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.calendario_contratual_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) then
      raise exception 'contrato_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  select c.cliente_id into v_cliente from comercial.contratos c where c.id = p_contrato_id for share;
  if not found or not config.sso_autorizar_acao('plano.gerir', v_cliente) then
    raise exception 'contrato_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  insert into pcm.calendario_contratual_series(id, cliente_id, contrato_id, created_by)
    values (p_serie_id, v_cliente, p_contrato_id, v_actor);
  insert into pcm.regras_visita_contratual(id, serie_id, numero, ancora_semana, dia_semana, intervalo_semanas,
    hora_inicio, duracao_minutos, deslocamento_minutos, fuso, vigencia_inicio, vigencia_fim, created_by)
    values (p_regra_id, p_serie_id, 1, p_ancora_semana, p_dia_semana, p_intervalo_semanas,
      p_hora_inicio, p_duracao_minutos, p_deslocamento_minutos, p_fuso, p_vigencia_inicio, p_vigencia_fim, v_actor)
    returning * into v_regra;
  v_resultado := jsonb_build_object('aggregateId', p_serie_id, 'revision', 1, 'state', 'registrada', 'created', true,
    'linkedIds', jsonb_build_object('clienteId', v_cliente, 'contratoId', p_contrato_id, 'regraId', p_regra_id),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'calendario.regra_criada', 'calendario_contratual_series', p_serie_id,
      jsonb_build_object('requestId', p_request_id, 'contratoId', p_contrato_id, 'depois', to_jsonb(v_regra)));
  insert into pcm.calendario_contratual_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_cliente, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_criar_regra_contratual(uuid, integer, uuid, uuid, uuid, date, integer, integer, time, integer, integer, text, date, date) from public, anon;
grant execute on function pcm.sso_criar_regra_contratual(uuid, integer, uuid, uuid, uuid, date, integer, integer, time, integer, integer, text, date, date) to authenticated;
