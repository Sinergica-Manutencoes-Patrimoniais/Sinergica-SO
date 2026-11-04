-- ADR-0039: fundação isolada do Plano, sem materialização ou sincronização.
create table pcm.planos_manutencao (
  id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  nome text not null check (length(btrim(nome)) between 1 and 200),
  estado text not null default 'rascunho' check (estado in ('rascunho', 'em_revisao', 'aprovado', 'ativo', 'suspenso', 'encerrado')),
  revisao integer not null default 1 check (revisao > 0),
  created_at timestamptz not null default now(), created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create index idx_planos_manutencao_cliente on pcm.planos_manutencao(cliente_id, id);
alter table pcm.planos_manutencao enable row level security;
alter table pcm.planos_manutencao force row level security;
grant select on pcm.planos_manutencao to authenticated;
create policy planos_manutencao_gestor_read on pcm.planos_manutencao for select to authenticated
  using (config.sso_autorizar_acao('plano.gerir', cliente_id));

create table pcm.plano_comandos (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null, resultado jsonb not null,
  created_at timestamptz not null default now()
);
alter table pcm.plano_comandos enable row level security;
alter table pcm.plano_comandos force row level security;

create function pcm.sso_salvar_plano_rascunho(p_request_id uuid, p_expected_revision integer,
  p_plano_id uuid, p_cliente_id uuid, p_nome text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_nome text := nullif(btrim(p_nome), '');
  v_plano pcm.planos_manutencao%rowtype; v_antes pcm.planos_manutencao%rowtype;
  v_comando pcm.plano_comandos%rowtype; v_payload jsonb; v_resultado jsonb; v_novo boolean;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_plano_id is null or p_cliente_id is null or v_nome is null or length(v_nome) > 200 then
    raise exception 'rascunho_invalido' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'salvarPlanoRascunho', 'expectedRevision', p_expected_revision,
    'planoId', p_plano_id, 'clienteId', p_cliente_id, 'nome', v_nome);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.plano_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano:' || p_plano_id::text, 0));
  select * into v_antes from pcm.planos_manutencao where id = p_plano_id for update;
  v_novo := not found;
  if v_novo then
    if not config.sso_autorizar_acao('plano.gerir', p_cliente_id) then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    insert into pcm.planos_manutencao(id, cliente_id, nome, created_by, updated_by)
      values (p_plano_id, p_cliente_id, v_nome, v_actor, v_actor) returning * into v_plano;
  else
    if v_antes.cliente_id is distinct from p_cliente_id or not config.sso_autorizar_acao('plano.gerir', v_antes.cliente_id) then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_antes.estado <> 'rascunho' then raise exception 'plano_nao_editavel' using errcode = '22023'; end if;
    if v_antes.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    update pcm.planos_manutencao set nome = v_nome, revisao = revisao + 1, updated_at = now(), updated_by = v_actor
      where id = p_plano_id returning * into v_plano;
  end if;
  v_resultado := jsonb_build_object('aggregateId', v_plano.id, 'revision', v_plano.revisao,
    'state', v_plano.estado, 'created', v_novo, 'linkedIds', jsonb_build_object('clienteId', v_plano.cliente_id),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, case when v_novo then 'plano.rascunho_criado' else 'plano.rascunho_atualizado' end,
      'planos_manutencao', p_plano_id, jsonb_build_object('requestId', p_request_id,
        'antes', case when v_novo then null else to_jsonb(v_antes) end, 'depois', to_jsonb(v_plano)));
  insert into pcm.plano_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_plano.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_salvar_plano_rascunho(uuid, integer, uuid, uuid, text) from public, anon;
grant execute on function pcm.sso_salvar_plano_rascunho(uuid, integer, uuid, uuid, text) to authenticated;
