-- ADR-1337: substituição futura do fluxo em chamadas independentes; gate fechado.
create table pcm.sso_confirmacao_chamado_os_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_confirmacao_chamado_os_gate(id, habilitado) values (true, false);
alter table pcm.sso_confirmacao_chamado_os_gate enable row level security;
alter table pcm.sso_confirmacao_chamado_os_gate force row level security;
revoke all on pcm.sso_confirmacao_chamado_os_gate from public, anon, authenticated, service_role;

create table pcm.sso_confirmacoes_chamado_os (
  request_id uuid primary key,
  ator_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id),
  os_id uuid not null references pcm.ordens_servico(id),
  chamado_id uuid not null references pcm.chamados(id),
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);
alter table pcm.sso_confirmacoes_chamado_os enable row level security;
alter table pcm.sso_confirmacoes_chamado_os force row level security;
revoke all on pcm.sso_confirmacoes_chamado_os from public, anon, authenticated, service_role;

create function pcm.sso_confirmar_chamado_os_atomico(p_request_id uuid, p_os_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_gate boolean;
  v_os pcm.ordens_servico%rowtype;
  v_anterior pcm.sso_confirmacoes_chamado_os%rowtype;
  v_chamado uuid;
  v_numero text;
  v_sync text;
  v_resultado jsonb;
begin
  if v_ator is null or p_request_id is null or p_os_id is null then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  select habilitado into v_gate from pcm.sso_confirmacao_chamado_os_gate where id for share;
  if v_gate is distinct from true then raise exception 'confirmacao_desabilitada' using errcode = '55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-confirmacao-chamado-os:' || p_request_id::text, 0));
  select * into v_anterior from pcm.sso_confirmacoes_chamado_os where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.os_id is distinct from p_os_id
      or config.sso_autorizar_acao('chamado.os.criar', v_anterior.cliente_id) is distinct from true then
      raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
    return v_anterior.resultado;
  end if;
  select * into v_os from pcm.ordens_servico where id = p_os_id and deleted_at is null for update;
  if not found or config.sso_autorizar_acao('chamado.os.criar', v_os.client_id) is distinct from true then
    raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  if v_os.chamado_id is not null or exists (
    select 1 from pcm.chamados c where c.ordem_servico_id = p_os_id and c.deleted_at is null
  ) then raise exception 'os_ja_possui_chamado' using errcode = '23514'; end if;
  if config.sso_autorizar_acao('chamado.os.criar', v_os.client_id) is distinct from true then
    raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  v_numero := pcm.fn_proximo_numero_chamado();
  insert into pcm.chamados(numero, cliente_id, titulo, descricao, local, foto_urls, origem, created_by, updated_by)
    values (v_numero, v_os.client_id, v_os.titulo, v_os.descricao, v_os.local_descricao,
      coalesce(v_os.foto_urls, '[]'::jsonb), 'manual', v_ator, v_ator) returning id into v_chamado;
  v_sync := current_setting('app.auvo_sync_write', true);
  perform pg_catalog.set_config('app.auvo_sync_write', 'true', true);
  update pcm.ordens_servico set chamado_id = v_chamado where id = p_os_id and chamado_id is null;
  if not found then raise exception 'os_alterada' using errcode = '40001'; end if;
  perform pg_catalog.set_config('app.auvo_sync_write', coalesce(v_sync, ''), true);
  update pcm.chamados set status = 'convertido_os', ordem_servico_id = p_os_id,
    updated_by = v_ator, updated_at = now() where id = v_chamado;
  insert into pcm.chamados_eventos(chamado_id, tipo, metadata, created_by) values
    (v_chamado, 'criado', pg_catalog.jsonb_build_object('numero', v_numero, 'auto', true, 'requestId', p_request_id), v_ator),
    (v_chamado, 'os_gerada', pg_catalog.jsonb_build_object('ordemServicoId', p_os_id, 'requestId', p_request_id), v_ator);
  v_resultado := pg_catalog.jsonb_build_object('requestId', p_request_id, 'osId', p_os_id,
    'clienteId', v_os.client_id, 'chamadoId', v_chamado, 'numero', v_numero, 'numeroOs', v_os.numero);
  insert into pcm.sso_confirmacoes_chamado_os(request_id, ator_id, cliente_id, os_id, chamado_id, resultado)
    values (p_request_id, v_ator, v_os.client_id, p_os_id, v_chamado, v_resultado);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'chamado.confirmado_os', 'chamados', v_chamado, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_confirmar_chamado_os_atomico(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_confirmar_chamado_os_atomico(uuid,uuid) to authenticated;
