-- ADR-1672: mediação somente leitura, gate fechado por padrão.
create table pcm.sso_hierarquia_grupos_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_hierarquia_grupos_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_hierarquia_grupos_mediada_gate enable row level security;
alter table pcm.sso_hierarquia_grupos_mediada_gate force row level security;
revoke all on pcm.sso_hierarquia_grupos_mediada_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_hierarquia_grupos_mediada(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(grupo_id uuid,grupo_nome text,quantidade bigint,local_nome text,area_nome text,sistema_nome text,local_estado text,sistema_estado text)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_hierarquia_grupos_mediada_gate where id and habilitado for share nowait;
 if not found then raise exception 'hierarquia_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_hierarquia_grupos_gate where id and habilitado for share nowait;
 if not found then raise exception 'hierarquia_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is distinct from true and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select h.* from pcm.sso_listar_hierarquia_grupos(p_cliente_id,p_apos,p_limite) h;
 if config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is distinct from true and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_hierarquia_grupos_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_hierarquia_grupos_mediada(uuid,uuid,uuid,integer) to authenticated;
