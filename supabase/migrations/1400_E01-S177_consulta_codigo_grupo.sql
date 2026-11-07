-- ADR-1247: consulta controlada por gate fechado; sem incorporação ou mutação.
create table pcm.sso_consulta_codigo_grupo_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_consulta_codigo_grupo_gate(id, habilitado) values (true, false);
alter table pcm.sso_consulta_codigo_grupo_gate enable row level security;
alter table pcm.sso_consulta_codigo_grupo_gate force row level security;
revoke all on pcm.sso_consulta_codigo_grupo_gate from public, anon, authenticated, service_role;

create function pcm.sso_consultar_codigo_grupo(p_cliente_id uuid, p_codigo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_encontrado pcm.sso_codigos_grupo_quantitativo%rowtype;
  v_atual text;
begin
  if auth.uid() is null or p_cliente_id is null or p_codigo is null
    or length(btrim(p_codigo)) not between 1 and 200 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  perform 1 from pcm.sso_consulta_codigo_grupo_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.ler', p_cliente_id) is not true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then
    raise exception 'codigo_em_alteracao' using errcode = '55P03';
  end if;
  select c.* into v_encontrado from pcm.sso_codigos_grupo_quantitativo c
    join pcm.grupos_quantitativos g on g.id = c.grupo_id and g.cliente_id = c.cliente_id
    where c.cliente_id = p_cliente_id and upper(btrim(c.codigo)) = upper(btrim(p_codigo))
      and g.deleted_at is null;
  if not found then return null; end if;
  select codigo into v_atual from pcm.sso_codigos_grupo_quantitativo
    where grupo_id = v_encontrado.grupo_id and cliente_id = p_cliente_id and atual;
  if not found then raise exception 'codigo_atual_indisponivel' using errcode = '23514'; end if;
  return jsonb_build_object('grupoId', v_encontrado.grupo_id, 'clienteId', p_cliente_id,
    'codigoAtual', v_atual, 'codigoHistorico', not v_encontrado.atual);
end $$;
revoke all on function pcm.sso_consultar_codigo_grupo(uuid, text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_consultar_codigo_grupo(uuid, text) to authenticated;
