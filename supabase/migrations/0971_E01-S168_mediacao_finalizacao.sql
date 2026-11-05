-- ADR-0764: superfície mediada restrita e fechada por padrão.
create table pcm.sso_mediacao_finalizacao_os_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
alter table pcm.sso_mediacao_finalizacao_os_gate enable row level security;
alter table pcm.sso_mediacao_finalizacao_os_gate force row level security;
revoke all on pcm.sso_mediacao_finalizacao_os_gate from public, anon, authenticated, service_role;
insert into pcm.sso_mediacao_finalizacao_os_gate(id, habilitado) values (true, false);

create function pcm.sso_autorizar_mediacao_finalizacao_os(p_cliente_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select habilitado from pcm.sso_mediacao_finalizacao_os_gate where id), false) then
    raise exception 'mediacao_finalizacao_bloqueada' using errcode = '55000';
  end if;
  if auth.uid() is null or p_cliente_id is null
     or config.sso_autorizar_acao('execucao.validar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
end; $$;
revoke all on function pcm.sso_autorizar_mediacao_finalizacao_os(uuid) from public, anon, authenticated, service_role;

create function pcm.sso_mediar_previa_finalizacao_os(p_cliente_id uuid, p_retorno_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform pcm.sso_autorizar_mediacao_finalizacao_os(p_cliente_id);
  return pcm.sso_previa_finalizacao_os(p_cliente_id, p_retorno_id);
end; $$;

create function pcm.sso_mediar_finalizacao_os(p_request_id uuid, p_cliente_id uuid, p_retorno_id uuid,
  p_expected_os_id uuid, p_atestacao_request_id uuid, p_expected_decisao integer,
  p_expected_status text, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform pcm.sso_autorizar_mediacao_finalizacao_os(p_cliente_id);
  return pcm.sso_finalizar_os_validada_v2(p_request_id, p_cliente_id, p_retorno_id, p_expected_os_id,
    p_atestacao_request_id, p_expected_decisao, p_expected_status, p_expected_updated_at);
end; $$;

create function pcm.sso_mediar_consulta_finalizacao_os(p_request_id uuid, p_cliente_id uuid, p_retorno_id uuid,
  p_atestacao_request_id uuid, p_expected_decisao integer, p_expected_status text, p_expected_updated_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform pcm.sso_autorizar_mediacao_finalizacao_os(p_cliente_id);
  return pcm.sso_consultar_finalizacao_os_por_pedido(p_request_id, p_cliente_id, p_retorno_id,
    p_atestacao_request_id, p_expected_decisao, p_expected_status, p_expected_updated_at);
end; $$;

revoke all on function pcm.sso_mediar_previa_finalizacao_os(uuid,uuid) from public, anon, service_role;
revoke all on function pcm.sso_mediar_finalizacao_os(uuid,uuid,uuid,uuid,uuid,integer,text,timestamptz) from public, anon, service_role;
revoke all on function pcm.sso_mediar_consulta_finalizacao_os(uuid,uuid,uuid,uuid,integer,text,timestamptz) from public, anon, service_role;
grant execute on function pcm.sso_mediar_previa_finalizacao_os(uuid,uuid) to authenticated;
grant execute on function pcm.sso_mediar_finalizacao_os(uuid,uuid,uuid,uuid,uuid,integer,text,timestamptz) to authenticated;
grant execute on function pcm.sso_mediar_consulta_finalizacao_os(uuid,uuid,uuid,uuid,integer,text,timestamptz) to authenticated;
