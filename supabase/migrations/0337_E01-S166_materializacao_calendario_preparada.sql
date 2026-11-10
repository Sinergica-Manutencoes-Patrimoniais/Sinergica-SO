-- ADR-0116: fundação fechada e não integrada ao gerador legado ou ao Auvo.
create table pcm.ocorrencia_rotina_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table pcm.ocorrencia_rotina_gate enable row level security;
alter table pcm.ocorrencia_rotina_gate force row level security;
revoke all on pcm.ocorrencia_rotina_gate from public, anon, authenticated, service_role;
insert into pcm.ocorrencia_rotina_gate(id, habilitado) values(true, false);

create table pcm.rotina_origem_geracao (
  rotina_logica_id uuid not null, alvo_tipo text not null check (alvo_tipo in ('sistema', 'componente', 'grupo')),
  alvo_id uuid not null, origem text not null check (origem in ('plano', 'pmoc')),
  primary key (rotina_logica_id, alvo_tipo, alvo_id)
);
alter table pcm.rotina_origem_geracao enable row level security;
alter table pcm.rotina_origem_geracao force row level security;
revoke all on pcm.rotina_origem_geracao from public, anon, authenticated, service_role;

create table pcm.ocorrencias_rotina_preparadas (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references pcm.planos_manutencao(id),
  versao_id uuid not null references pcm.plano_versoes(id),
  rotina_id uuid not null references pcm.rotinas_manutencao(id),
  rotina_logica_id uuid not null,
  alvo_tipo text not null check (alvo_tipo in ('sistema', 'componente', 'grupo')),
  alvo_id uuid not null,
  ciclo integer not null check (ciclo >= 0),
  vencimento_original date not null,
  tolerancia_antes integer not null check (tolerancia_antes >= 0),
  tolerancia_depois integer not null check (tolerancia_depois >= 0),
  created_at timestamptz not null default now(), created_by uuid not null references auth.users(id),
  unique (rotina_logica_id, alvo_tipo, alvo_id, vencimento_original)
);
alter table pcm.ocorrencias_rotina_preparadas enable row level security;
alter table pcm.ocorrencias_rotina_preparadas force row level security;
revoke all on pcm.ocorrencias_rotina_preparadas from public, anon, authenticated, service_role;

create function pcm.sso_materializar_rotina_calendario(
  p_request_id uuid, p_plano_id uuid, p_versao_id uuid, p_rotina_id uuid,
  p_expected_revision integer, p_inicio date, p_fim date
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'America/Sao_Paulo' as $$
declare
  v_actor uuid := auth.uid(); v_plano pcm.planos_manutencao%rowtype; v_versao pcm.plano_versoes%rowtype;
  v_rotina jsonb; v_quantidade integer; v_logica uuid; v_alvo uuid; v_tipo text;
  v_linha record; v_criadas integer := 0; v_inseridas integer; v_comando pcm.calendario_contratual_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id), false) then
    raise exception 'materializacao_bloqueada' using errcode = '55000'; end if;
  if v_actor is null or p_request_id is null or p_plano_id is null or p_versao_id is null
    or p_rotina_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim)
    or p_fim < p_inicio then
    raise exception 'janela_invalida' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('tipo', 'materializarRotinaCalendario', 'planoId', p_plano_id,
    'versaoId', p_versao_id, 'rotinaId', p_rotina_id, 'expectedRevision', p_expected_revision,
    'inicio', p_inicio, 'fim', p_fim);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.calendario_contratual_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor
      or config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) is distinct from true then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if p_inicio < current_date or p_fim > current_date + 30 then
    raise exception 'janela_invalida' using errcode = '22023'; end if;
  select * into v_plano from pcm.planos_manutencao where id = p_plano_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir', v_plano.cliente_id) is distinct from true then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  if v_plano.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_plano.estado not in ('aprovado', 'ativo') then raise exception 'plano_nao_ativo' using errcode = '23514'; end if;
  select * into v_versao from pcm.plano_versoes where id = p_versao_id and plano_id = p_plano_id for share;
  if not found or v_versao.estado <> 'aprovado' or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then
    raise exception 'versao_indisponivel' using errcode = '23514'; end if;
  select count(*), min(r.item::text)::jsonb into v_quantidade, v_rotina
    from jsonb_array_elements(v_versao.snapshot->'rotinas') r(item) where r.item->>'id' = p_rotina_id::text;
  if v_quantidade <> 1 or v_rotina->>'modo' is distinct from 'calendario' then
    raise exception 'rotina_indisponivel' using errcode = '23514'; end if;
  v_logica := (v_rotina->>'rotina_logica_id')::uuid;
  v_tipo := v_rotina->>'alvo_tipo';
  v_alvo := case v_tipo when 'sistema' then (v_rotina->>'sistema_id')::uuid
    when 'componente' then (v_rotina->>'equipamento_id')::uuid when 'grupo' then (v_rotina->>'grupo_id')::uuid end;
  if v_logica is null or v_alvo is null or not exists (select 1 from pcm.rotina_origem_geracao g
    where g.rotina_logica_id = v_logica and g.alvo_tipo = v_tipo and g.alvo_id = v_alvo and g.origem = 'plano') then
    raise exception 'origem_geracao_nao_comprovada' using errcode = '23514'; end if;
  for v_linha in select * from pcm.sso_prever_ciclos_rotina(p_plano_id, p_versao_id, p_rotina_id, p_inicio, p_fim) loop
    insert into pcm.ocorrencias_rotina_preparadas(plano_id, versao_id, rotina_id, rotina_logica_id,
      alvo_tipo, alvo_id, ciclo, vencimento_original, tolerancia_antes, tolerancia_depois, created_by)
      values (p_plano_id, p_versao_id, p_rotina_id, v_logica, v_tipo, v_alvo, v_linha.ciclo,
        v_linha.vencimento, v_linha.tolerancia_antes, v_linha.tolerancia_depois, v_actor)
      on conflict (rotina_logica_id, alvo_tipo, alvo_id, vencimento_original) do nothing;
    get diagnostics v_inseridas = row_count;
    v_criadas := v_criadas + v_inseridas;
  end loop;
  v_resultado := jsonb_build_object('planoId', p_plano_id, 'rotinaId', p_rotina_id, 'criadas', v_criadas, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'calendario.ocorrencias_preparadas', 'planos_manutencao', p_plano_id, v_resultado);
  insert into pcm.calendario_contratual_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_plano.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_materializar_rotina_calendario(uuid, uuid, uuid, uuid, integer, date, date)
  from public, anon, authenticated, service_role;
