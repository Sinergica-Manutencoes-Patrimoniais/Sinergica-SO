create table comercial.sso_historico_legado_operacional_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_historico_legado_operacional_gate(id,habilitado) values(true,false);
alter table comercial.sso_historico_legado_operacional_gate enable row level security;
alter table comercial.sso_historico_legado_operacional_gate force row level security;
revoke all on comercial.sso_historico_legado_operacional_gate from public,anon,authenticated,service_role;
create function comercial.sso_listar_historico_orcamento_legado_os(p_cliente_id uuid,p_os_id uuid,p_apos uuid,p_limite integer)
returns table(orcamento_id uuid,numero text,status text,valido_ate date,criado_em timestamptz,decisao_id uuid,decisao text,decisao_em timestamptz,decisao_autor uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from comercial.sso_historico_legado_operacional_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_os_id is null or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select o.id,o.numero,o.status,o.valido_ate,o.created_at,d.id,d.decisao,d.created_at,d.autor_user_id from pcm.orcamentos_servico o
 left join pcm.orcamento_decisoes d on d.orcamento_id=o.id and d.cliente_id=p_cliente_id
 where o.cliente_id=p_cliente_id and o.ordem_servico_id=p_os_id and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end $$;
revoke all on function comercial.sso_listar_historico_orcamento_legado_os(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
