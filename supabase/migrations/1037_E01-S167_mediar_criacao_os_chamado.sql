-- ADR-0849: interface mediada fechada; núcleo e restrições legadas permanecem intactos.
create table pcm.sso_criacao_os_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_criacao_os_mediada_gate enable row level security;
alter table pcm.sso_criacao_os_mediada_gate force row level security;
revoke all on pcm.sso_criacao_os_mediada_gate from public,anon,authenticated,service_role;
insert into pcm.sso_criacao_os_mediada_gate(id,habilitado) values(true,false);

create function pcm.sso_criar_os_chamado_autorizado(
 p_request_id uuid,p_expected_revision bigint,p_chamado_id uuid,p_cliente_id uuid,
 p_os_id uuid,p_titulo text,p_descricao text,p_categoria text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_criacao_os_mediada_gate where id),false) then raise exception 'criacao_mediada_bloqueada' using errcode='55000'; end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_criacao_os_mediada_gate where id for share;
 if not coalesce((select habilitado from pcm.sso_criacao_os_mediada_gate where id),false) then raise exception 'criacao_mediada_bloqueada' using errcode='55000'; end if;
 perform 1 from pcm.chamado_os_gate where id for share;
 if auth.uid() is null or p_cliente_id is null or p_chamado_id is null or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true
   or not exists(select 1 from pcm.chamados c where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null) then
   raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 return pcm.sso_criar_os_chamado(p_request_id,p_expected_revision,p_chamado_id,p_cliente_id,p_os_id,p_titulo,p_descricao,p_categoria);
end; $$;
revoke all on function pcm.sso_criar_os_chamado_autorizado(uuid,bigint,uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_criar_os_chamado_autorizado(uuid,bigint,uuid,uuid,uuid,text,text,text) to authenticated;
