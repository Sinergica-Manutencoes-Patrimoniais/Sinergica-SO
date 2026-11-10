-- ADR-1250: consulta paginada, gate fechado.
create table pcm.sso_historico_codigo_grupo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_historico_codigo_grupo_gate(id, habilitado) values(true, false);
alter table pcm.sso_historico_codigo_grupo_gate enable row level security;
alter table pcm.sso_historico_codigo_grupo_gate force row level security;
revoke all on pcm.sso_historico_codigo_grupo_gate from public, anon, authenticated, service_role;

create function pcm.sso_historico_codigo_grupo(p_cliente_id uuid, p_grupo_id uuid, p_apos timestamptz, p_apos_id uuid, p_limite integer)
returns table(id uuid, codigo text, atual boolean, ator_id uuid, criado_em timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_grupo_id is null or p_limite is null or p_limite not between 1 and 100
    or (p_apos is null) <> (p_apos_id is null) then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform 1 from pcm.sso_historico_codigo_grupo_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.ler', p_cliente_id) is not true or not exists
    (select 1 from pcm.grupos_quantitativos g where g.id = p_grupo_id and g.cliente_id = p_cliente_id and g.deleted_at is null) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then
    raise exception 'codigo_em_alteracao' using errcode = '55P03';
  end if;
  return query select c.id, c.codigo, c.atual, c.ator_id, c.criado_em from pcm.sso_codigos_grupo_quantitativo c
    where c.cliente_id = p_cliente_id and c.grupo_id = p_grupo_id
      and (p_apos is null or (c.criado_em, c.id) < (p_apos, p_apos_id))
    order by c.criado_em desc, c.id desc limit p_limite;
end $$;
revoke all on function pcm.sso_historico_codigo_grupo(uuid, uuid, timestamptz, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_historico_codigo_grupo(uuid, uuid, timestamptz, uuid, integer) to authenticated;
