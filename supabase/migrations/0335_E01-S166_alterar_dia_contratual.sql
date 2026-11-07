-- ADR-0114: proposta fechada; sem materializar Visita, Ocorrência ou tarefa Auvo.
create table pcm.calendario_alteracao_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
alter table pcm.calendario_alteracao_gate enable row level security;
alter table pcm.calendario_alteracao_gate force row level security;
revoke all on pcm.calendario_alteracao_gate from public, anon, authenticated, service_role;
insert into pcm.calendario_alteracao_gate(id, habilitado) values(true, false);

create function pcm.sso_alterar_dia_contratual(
  p_request_id uuid, p_serie_id uuid, p_regra_nova_id uuid, p_expected_revision integer,
  p_dia_semana integer, p_vigencia date
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_serie pcm.calendario_contratual_series%rowtype;
  v_antiga pcm.regras_visita_contratual%rowtype; v_nova pcm.regras_visita_contratual%rowtype;
  v_comando pcm.calendario_contratual_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.calendario_alteracao_gate where id), false) then
    raise exception 'alteracao_calendario_bloqueada' using errcode = '55000'; end if;
  if v_actor is null or p_request_id is null or p_serie_id is null or p_regra_nova_id is null
    or p_expected_revision is null or p_expected_revision < 1 or p_dia_semana is null
    or p_dia_semana not between 1 and 7 or p_vigencia is null or not isfinite(p_vigencia) then
    raise exception 'comando_invalido' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('tipo', 'alterarDiaContratual', 'serieId', p_serie_id,
    'regraNovaId', p_regra_nova_id, 'expectedRevision', p_expected_revision,
    'diaSemana', p_dia_semana, 'vigencia', p_vigencia);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.calendario_contratual_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor
      or config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) is distinct from true then
      raise exception 'contrato_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  select * into v_serie from pcm.calendario_contratual_series where id = p_serie_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir', v_serie.cliente_id) is distinct from true then
    raise exception 'contrato_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_antiga from pcm.regras_visita_contratual where serie_id = p_serie_id
    order by numero desc limit 1 for update;
  if not found or v_antiga.numero <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if p_dia_semana = v_antiga.dia_semana or p_vigencia <= v_antiga.vigencia_inicio
    or p_vigencia <= (now() at time zone v_antiga.fuso)::date
    or (v_antiga.vigencia_fim is not null and p_vigencia > v_antiga.vigencia_fim) then
    raise exception 'vigencia_ou_dia_invalido' using errcode = '22023'; end if;
  if exists (select 1 from pcm.visita_origem_contratual o
    join pcm.visitas v on v.id = o.visita_id
    where o.serie_id = p_serie_id and (v.inicio_em at time zone v_antiga.fuso)::date >= p_vigencia) then
    raise exception 'visitas_futuras_exigem_reconciliacao' using errcode = '23514'; end if;
  update pcm.regras_visita_contratual set vigencia_fim = p_vigencia - 1 where id = v_antiga.id;
  insert into pcm.regras_visita_contratual(id, serie_id, numero, ancora_semana, dia_semana, intervalo_semanas,
    hora_inicio, duracao_minutos, deslocamento_minutos, fuso, vigencia_inicio, vigencia_fim, created_by)
    values (p_regra_nova_id, p_serie_id, v_antiga.numero + 1, v_antiga.ancora_semana, p_dia_semana,
      v_antiga.intervalo_semanas, v_antiga.hora_inicio, v_antiga.duracao_minutos, v_antiga.deslocamento_minutos,
      v_antiga.fuso, p_vigencia, v_antiga.vigencia_fim, v_actor) returning * into v_nova;
  v_resultado := jsonb_build_object('serieId', p_serie_id, 'regraId', v_nova.id,
    'revision', v_nova.numero, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'calendario.dia_alterado', 'calendario_contratual_series', p_serie_id,
      jsonb_build_object('requestId', p_request_id, 'antes', to_jsonb(v_antiga), 'depois', to_jsonb(v_nova)));
  insert into pcm.calendario_contratual_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_serie.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_alterar_dia_contratual(uuid, uuid, uuid, integer, integer, date)
  from public, anon, authenticated, service_role;
