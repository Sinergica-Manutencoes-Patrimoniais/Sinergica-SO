-- ADR-1335: comando individual, fechado por padrão; não modifica vínculos em massa.
create table pcm.sso_canonicalizacao_chamado_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_canonicalizacao_chamado_gate(id, habilitado) values (true, false);
alter table pcm.sso_canonicalizacao_chamado_gate enable row level security;
alter table pcm.sso_canonicalizacao_chamado_gate force row level security;
revoke all on pcm.sso_canonicalizacao_chamado_gate from public, anon, authenticated, service_role;

create table pcm.sso_canonicalizacoes_chamado (
  request_id uuid primary key,
  ator_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id),
  chamado_id uuid not null references pcm.chamados(id),
  os_id uuid not null references pcm.ordens_servico(id),
  payload jsonb not null,
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);
alter table pcm.sso_canonicalizacoes_chamado enable row level security;
alter table pcm.sso_canonicalizacoes_chamado force row level security;
revoke all on pcm.sso_canonicalizacoes_chamado from public, anon, authenticated, service_role;

create function pcm.sso_canonicalizar_vinculo_chamado(
  p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_os_id uuid,
  p_expected_revision bigint, p_motivo text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_gate boolean;
  v_chamado pcm.chamados%rowtype;
  v_os pcm.ordens_servico%rowtype;
  v_anterior pcm.sso_canonicalizacoes_chamado%rowtype;
  v_payload jsonb;
  v_resultado jsonb;
  v_sync text;
begin
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null
    or p_os_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  select habilitado into v_gate from pcm.sso_canonicalizacao_chamado_gate where id for share;
  if v_gate is distinct from true then raise exception 'canonicalizacao_desabilitada' using errcode = '55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  if config.sso_autorizar_acao('chamado.os.criar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  v_payload := pg_catalog.jsonb_build_object('clienteId', p_cliente_id, 'chamadoId', p_chamado_id,
    'osId', p_os_id, 'expectedRevision', p_expected_revision, 'motivo', btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-canonicalizacao-chamado:' || p_request_id::text, 0));
  select * into v_anterior from pcm.sso_canonicalizacoes_chamado where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.cliente_id is distinct from p_cliente_id
      or v_anterior.payload is distinct from v_payload then
      raise exception 'request_conflitante' using errcode = '23505';
    end if;
    return v_anterior.resultado;
  end if;
  -- Evita assumir que outros escritores do legado usem a mesma trava consultiva.
  lock table pcm.chamados, pcm.ordens_servico in share row exclusive mode nowait;
  select * into v_chamado from pcm.chamados
    where id = p_chamado_id and cliente_id = p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'chamado_nao_encontrado' using errcode = '42501'; end if;
  select * into v_os from pcm.ordens_servico
    where id = p_os_id and client_id = p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'os_nao_encontrada' using errcode = '42501'; end if;
  if v_chamado.sso_revisao is distinct from p_expected_revision then
    raise exception 'revisao_obsoleta' using errcode = '40001';
  end if;
  if v_chamado.ordem_servico_id is distinct from p_os_id or v_os.chamado_id is not null then
    raise exception 'vinculo_nao_elegivel' using errcode = '23514';
  end if;
  perform pcm.sso_exigir_vinculo_chamado_consistente(p_cliente_id, p_chamado_id);
  if exists (select 1 from pcm.ordens_servico o where o.chamado_id = p_chamado_id and o.deleted_at is null) then
    raise exception 'chamado_ja_possui_os_canonica' using errcode = '23514';
  end if;
  -- Revalidar após as esperas e antes da escrita; não substitui a revisão de todas as fontes.
  if config.sso_autorizar_acao('chamado.os.criar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  v_sync := current_setting('app.auvo_sync_write', true);
  perform pg_catalog.set_config('app.auvo_sync_write', 'true', true);
  update pcm.ordens_servico set chamado_id = p_chamado_id where id = p_os_id and chamado_id is null;
  if not found then raise exception 'vinculo_alterado' using errcode = '40001'; end if;
  perform pg_catalog.set_config('app.auvo_sync_write', coalesce(v_sync, ''), true);
  v_resultado := pg_catalog.jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id,
    'chamadoId', p_chamado_id, 'osId', p_os_id, 'numeroOs', v_os.numero);
  insert into pcm.sso_canonicalizacoes_chamado(request_id, ator_id, cliente_id, chamado_id, os_id, payload, resultado)
    values (p_request_id, v_ator, p_cliente_id, p_chamado_id, p_os_id, v_payload, v_resultado);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'chamado.vinculo_canonicalizado', 'chamados', p_chamado_id,
      pg_catalog.jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'osId', p_os_id, 'motivo', btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_canonicalizar_vinculo_chamado(uuid,uuid,uuid,uuid,bigint,text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_canonicalizar_vinculo_chamado(uuid,uuid,uuid,uuid,bigint,text) to authenticated;
