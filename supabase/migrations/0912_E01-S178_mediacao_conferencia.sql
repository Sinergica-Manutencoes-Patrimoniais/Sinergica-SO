create table pcm.sso_mediacao_conferencia_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_mediacao_conferencia_gate(id, habilitado) values (true, false);
alter table pcm.sso_mediacao_conferencia_gate enable row level security;
alter table pcm.sso_mediacao_conferencia_gate force row level security;
revoke all on pcm.sso_mediacao_conferencia_gate from public, anon, authenticated, service_role;

create function pcm.sso_conferir_linha_autorizada(
  p_request_id uuid, p_lote_id uuid, p_expected_revision integer, p_chave text, p_atributos jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cliente_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_mediacao_conferencia_gate where id), false) then
    raise exception 'conferencia_desabilitada' using errcode = '55000';
  end if;
  if auth.uid() is null or p_lote_id is null then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  select cliente_id into v_cliente_id from pcm.sso_levantamentos where id = p_lote_id;
  if not found or v_cliente_id is null or config.sso_autorizar_acao('cadastro.aprovar', v_cliente_id) is not true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return pcm.sso_registrar_conferencia_linha(p_request_id, p_lote_id, p_expected_revision, p_chave, p_atributos);
end;
$$;
revoke all on function pcm.sso_conferir_linha_autorizada(uuid, uuid, integer, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_conferir_linha_autorizada(uuid, uuid, integer, text, jsonb) to authenticated;

create function pcm.sso_resumo_conferencia_autorizado(p_lote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cliente_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_mediacao_conferencia_gate where id), false) then
    raise exception 'conferencia_desabilitada' using errcode = '55000';
  end if;
  if auth.uid() is null or p_lote_id is null then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  select cliente_id into v_cliente_id from pcm.sso_levantamentos where id = p_lote_id;
  if not found or v_cliente_id is null or config.sso_autorizar_acao('cadastro.aprovar', v_cliente_id) is not true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return pcm.sso_resumo_conferencia_lote(p_lote_id);
end;
$$;
revoke all on function pcm.sso_resumo_conferencia_autorizado(uuid) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_resumo_conferencia_autorizado(uuid) to authenticated;
