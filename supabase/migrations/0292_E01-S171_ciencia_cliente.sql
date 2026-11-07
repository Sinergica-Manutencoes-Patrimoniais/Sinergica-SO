-- ADR-0068: ciência é evidência independente, sem liberar envio.
alter table pcm.visita_confirmacoes add constraint visita_confirmacoes_escopo_s171_unique unique (id, visita_id, cliente_id, revisao);
create table pcm.visita_ciencias (
  id uuid primary key,
  visita_id uuid not null,
  cliente_id uuid not null,
  revisao_visita integer not null check (revisao_visita > 0),
  confirmacao_id uuid,
  ciencia_em timestamptz not null check (isfinite(ciencia_em)),
  responsavel text not null check (length(btrim(responsavel)) between 1 and 200),
  canal text not null check (length(btrim(canal)) between 1 and 120),
  observacao text not null check (length(btrim(observacao)) between 1 and 2000),
  registrado_por uuid not null references auth.users(id),
  registrado_em timestamptz not null default now(),
  foreign key (visita_id, cliente_id) references pcm.visitas(id, cliente_id),
  foreign key (confirmacao_id, visita_id, cliente_id, revisao_visita)
    references pcm.visita_confirmacoes(id, visita_id, cliente_id, revisao)
);
create index idx_visita_ciencias_visita on pcm.visita_ciencias(visita_id, registrado_em, id);
alter table pcm.visita_ciencias enable row level security;
alter table pcm.visita_ciencias force row level security;
revoke all on pcm.visita_ciencias from public, anon, authenticated, service_role;
grant select on pcm.visita_ciencias to authenticated;
create policy visita_ciencias_leitura on pcm.visita_ciencias for select to authenticated
  using (config.sso_autorizar_acao('visita.confirmar', cliente_id));
create function pcm.sso_proteger_ciencia_visita() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'ciencia_visita_imutavel' using errcode = '23514'; end;
$$;
revoke all on function pcm.sso_proteger_ciencia_visita() from public, anon, authenticated, service_role;
create trigger sso_ciencia_visita_imutavel before update or delete on pcm.visita_ciencias
for each row execute function pcm.sso_proteger_ciencia_visita();

create function pcm.sso_registrar_ciencia_visita(
  p_request_id uuid, p_expected_revision integer, p_visita_id uuid, p_ciencia_em timestamptz,
  p_responsavel text, p_canal text, p_observacao text
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_visita pcm.visitas%rowtype; v_comando pcm.visita_comandos%rowtype;
  v_confirmacao uuid; v_ciencia pcm.visita_ciencias%rowtype; v_payload jsonb; v_resultado jsonb;
  v_responsavel text := nullif(btrim(p_responsavel), ''); v_canal text := nullif(btrim(p_canal), '');
  v_observacao text := nullif(btrim(p_observacao), '');
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1 or p_visita_id is null
    or p_ciencia_em is null or not isfinite(p_ciencia_em) or v_responsavel is null or length(v_responsavel) > 200
    or v_canal is null or length(v_canal) > 120 or v_observacao is null or length(v_observacao) > 2000 then
    raise exception 'ciencia_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'registrarCienciaVisita', 'expectedRevision', p_expected_revision,
    'visitaId', p_visita_id, 'cienciaEm', p_ciencia_em, 'responsavel', v_responsavel, 'canal', v_canal, 'observacao', v_observacao);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:' || p_request_id::text, 0));
  select * into v_visita from pcm.visitas where id = p_visita_id for update;
  if not found or not config.sso_autorizar_acao('visita.confirmar', v_visita.cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('visita.confirmar', v_comando.cliente_id) then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_visita.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_visita.estado not in ('planejada', 'confirmada') then raise exception 'transicao_invalida' using errcode = '22023'; end if;
  if v_visita.estado = 'confirmada' then
    select id into v_confirmacao from pcm.visita_confirmacoes
      where visita_id = p_visita_id and cliente_id = v_visita.cliente_id and revisao = v_visita.revisao;
    if not found then raise exception 'confirmacao_ausente' using errcode = '23514'; end if;
  end if;
  insert into pcm.visita_ciencias(id, visita_id, cliente_id, revisao_visita, confirmacao_id, ciencia_em, responsavel, canal, observacao, registrado_por)
    values (p_request_id, p_visita_id, v_visita.cliente_id, v_visita.revisao, v_confirmacao, p_ciencia_em, v_responsavel, v_canal, v_observacao, v_actor)
    returning * into v_ciencia;
  v_resultado := jsonb_build_object('aggregateId', p_visita_id, 'revision', v_visita.revisao, 'state', v_visita.estado,
    'created', true, 'linkedIds', jsonb_build_object('clienteId', v_visita.cliente_id, 'cienciaId', v_ciencia.id, 'confirmacaoId', v_confirmacao),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'visita.ciencia_registrada', 'visitas', p_visita_id, jsonb_build_object('requestId', p_request_id, 'ciencia', to_jsonb(v_ciencia)));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_visita.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_registrar_ciencia_visita(uuid, integer, uuid, timestamptz, text, text, text) from public, anon;
grant execute on function pcm.sso_registrar_ciencia_visita(uuid, integer, uuid, timestamptz, text, text, text) to authenticated;
