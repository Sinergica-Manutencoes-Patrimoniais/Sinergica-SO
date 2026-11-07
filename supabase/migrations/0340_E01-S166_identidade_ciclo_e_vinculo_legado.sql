-- ADR-0116: ponte de identidade preparada; sem criação automática no legado.
create table pcm.ciclos_rotina_identidades (
  id uuid primary key,
  rotina_logica_id uuid not null,
  alvo_tipo text not null check (alvo_tipo in ('sistema', 'componente', 'grupo')),
  alvo_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
create table pcm.ocorrencias_rotina_vinculos (
  ocorrencia_preparada_id uuid primary key references pcm.ocorrencias_rotina_preparadas(id),
  ciclo_id uuid not null references pcm.ciclos_rotina_identidades(id),
  ocorrencia_legada_id uuid unique references pcm.ocorrencias_preventivas(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique(ciclo_id)
);
alter table pcm.ciclos_rotina_identidades enable row level security;
alter table pcm.ciclos_rotina_identidades force row level security;
alter table pcm.ocorrencias_rotina_vinculos enable row level security;
alter table pcm.ocorrencias_rotina_vinculos force row level security;
revoke all on pcm.ciclos_rotina_identidades, pcm.ocorrencias_rotina_vinculos from public, anon, authenticated, service_role;

-- Função privada só vincula registro legado existente, nunca fabrica plano legado nem cria tarefa.
create function pcm.sso_vincular_ocorrencia_preparada(
  p_request_id uuid, p_preparada_id uuid, p_ciclo_id uuid, p_ocorrencia_legada_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_preparada pcm.ocorrencias_rotina_preparadas%rowtype;
  v_legada pcm.ocorrencias_preventivas%rowtype; v_plano_legado pcm.planos_preventivos%rowtype;
  v_cliente uuid; v_comando pcm.calendario_contratual_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id), false) then
    raise exception 'materializacao_bloqueada' using errcode = '55000'; end if;
  if v_actor is null or p_request_id is null or p_preparada_id is null or p_ciclo_id is null
    or p_ocorrencia_legada_id is null then raise exception 'comando_invalido' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('tipo', 'vincularOcorrenciaPreparada', 'preparadaId', p_preparada_id,
    'cicloId', p_ciclo_id, 'legadaId', p_ocorrencia_legada_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.calendario_contratual_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor
      or config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) is distinct from true then
      raise exception 'ocorrencia_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  select * into v_preparada from pcm.ocorrencias_rotina_preparadas where id = p_preparada_id for update;
  if not found then raise exception 'ocorrencia_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select cliente_id into v_cliente from pcm.planos_manutencao where id = v_preparada.plano_id for share;
  if v_cliente is null or config.sso_autorizar_acao('plano.gerir', v_cliente) is distinct from true then
    raise exception 'ocorrencia_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_legada from pcm.ocorrencias_preventivas where id = p_ocorrencia_legada_id for update;
  if not found then raise exception 'ocorrencia_legada_invalida' using errcode = '23514'; end if;
  select * into v_plano_legado from pcm.planos_preventivos where id = v_legada.plano_id for share;
  if not found or v_plano_legado.cliente_id is distinct from v_cliente
    or v_legada.vencimento is distinct from v_preparada.vencimento_original
    or not ((v_preparada.alvo_tipo = 'sistema' and v_plano_legado.sistema_id = v_preparada.alvo_id)
      or (v_preparada.alvo_tipo = 'componente' and v_plano_legado.equipamento_id = v_preparada.alvo_id)) then
    raise exception 'ocorrencia_legada_incompativel' using errcode = '23514'; end if;
  insert into pcm.ciclos_rotina_identidades(id, rotina_logica_id, alvo_tipo, alvo_id, created_by)
    values (p_ciclo_id, v_preparada.rotina_logica_id, v_preparada.alvo_tipo, v_preparada.alvo_id, v_actor);
  insert into pcm.ocorrencias_rotina_vinculos(ocorrencia_preparada_id, ciclo_id, ocorrencia_legada_id, created_by)
    values (p_preparada_id, p_ciclo_id, p_ocorrencia_legada_id, v_actor);
  v_resultado := jsonb_build_object('preparadaId', p_preparada_id, 'cicloId', p_ciclo_id,
    'ocorrenciaLegadaId', p_ocorrencia_legada_id, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'calendario.ocorrencia_legada_vinculada', 'planos_manutencao', v_preparada.plano_id, v_resultado);
  insert into pcm.calendario_contratual_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_cliente, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_vincular_ocorrencia_preparada(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
