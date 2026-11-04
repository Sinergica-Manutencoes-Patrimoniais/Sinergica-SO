-- ADR-1251: entrada para atribuição inicial; gate fechado.
create table pcm.sso_atribuicao_codigo_grupo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_atribuicao_codigo_grupo_gate(id, habilitado) values(true, false);
alter table pcm.sso_atribuicao_codigo_grupo_gate enable row level security;
alter table pcm.sso_atribuicao_codigo_grupo_gate force row level security;
revoke all on pcm.sso_atribuicao_codigo_grupo_gate from public, anon, authenticated, service_role;

create function pcm.sso_atribuir_codigo_grupo(p_request_id uuid, p_cliente_id uuid, p_grupo_id uuid, p_codigo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or p_cliente_id is null or p_grupo_id is null then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform 1 from pcm.sso_atribuicao_codigo_grupo_gate where id and habilitado for share;
  if not found then raise exception 'atribuicao_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.aprovar', p_cliente_id) is not true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.grupos_quantitativos where id = p_grupo_id and cliente_id = p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'sem_acesso' using errcode = '42501'; end if;
  v_id := pcm.sso_atribuir_codigo_inicial_grupo_privado(p_request_id, p_grupo_id, p_codigo);
  return jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'grupoId', p_grupo_id, 'codigoId', v_id, 'codigo', p_codigo);
end $$;
revoke all on function pcm.sso_atribuir_codigo_grupo(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_atribuir_codigo_grupo(uuid, uuid, uuid, text) to authenticated;
