-- ADR-0754: leitura autorizada, gate fechado e dados preservados.
create table pcm.sso_listagem_aliases_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_listagem_aliases_gate(id,habilitado) values(true,false);
alter table pcm.sso_listagem_aliases_gate enable row level security;
alter table pcm.sso_listagem_aliases_gate force row level security;
revoke all on pcm.sso_listagem_aliases_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_aliases_ativo(p_cliente_id uuid,p_tipo text,p_ativo_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,codigo text,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.sso_listagem_aliases_gate g where g.id),false) then raise exception 'listagem_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is not true then raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  if p_tipo is null or p_tipo not in ('sistema','componente') or p_ativo_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not ((p_tipo='sistema' and exists(select 1 from pcm.sistemas s where s.id=p_ativo_id and s.cliente_id=p_cliente_id and s.deleted_at is null)) or (p_tipo='componente' and exists(select 1 from pcm.equipamentos e where e.id=p_ativo_id and e.client_id=p_cliente_id and e.deleted_at is null))) then raise exception 'ativo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return query select a.id,a.codigo,a.criado_em from pcm.sso_codigo_aliases a where a.cliente_id=p_cliente_id and ((p_tipo='sistema' and a.sistema_id=p_ativo_id) or (p_tipo='componente' and a.componente_id=p_ativo_id)) and (p_apos is null or a.id>p_apos) order by a.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_aliases_ativo(uuid,text,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_aliases_ativo(uuid,text,uuid,uuid,integer) to authenticated;
