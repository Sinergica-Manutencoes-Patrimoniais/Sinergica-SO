-- ADR-0283: consulta privada, não concedida e desligada.
create table pcm.sso_hierarquia_grupos_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_hierarquia_grupos_gate(id,habilitado) values(true,false);
alter table pcm.sso_hierarquia_grupos_gate enable row level security;
alter table pcm.sso_hierarquia_grupos_gate force row level security;
revoke all on pcm.sso_hierarquia_grupos_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_hierarquia_grupos(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(grupo_id uuid,grupo_nome text,quantidade bigint,local_nome text,area_nome text,sistema_nome text,local_estado text,sistema_estado text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.sso_hierarquia_grupos_gate where id),false) then raise exception 'hierarquia_grupos_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select g.id,g.nome,g.quantidade,
    case when a.id is not null and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null then l.nome end,
    case when a.id is not null and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null then a.nome end,
    case when s.id is not null and s.ativo and s.deleted_at is null then s.nome end,
    case when a.id is not null and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null then 'disponivel' else 'indisponivel' end,
    case when g.sistema_id is null then 'nao_vinculado' when s.id is not null and s.ativo and s.deleted_at is null then 'disponivel' else 'indisponivel' end
    from pcm.grupos_quantitativos g left join pcm.locais l on l.id=g.local_id left join pcm.areas a on a.id=l.area_id and a.cliente_id=p_cliente_id
    left join pcm.sistemas s on s.id=g.sistema_id and s.cliente_id=p_cliente_id
    where g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null and (p_apos is null or g.id>p_apos) order by g.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_hierarquia_grupos(uuid,uuid,integer) from public,anon,authenticated,service_role;
