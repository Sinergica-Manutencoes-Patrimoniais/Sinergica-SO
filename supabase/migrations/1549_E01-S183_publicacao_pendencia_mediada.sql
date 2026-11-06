-- ADR-1405: publicação explícita, somente conteúdo fornecido para o Portal.
create table pcm.sso_publicacao_pendencia_mediada_gate(id boolean primary key default true check(id),portal boolean not null default false,leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_publicacao_pendencia_mediada_gate(id,portal,leitura,escrita) values(true,false,false,false);
alter table pcm.sso_publicacao_pendencia_mediada_gate enable row level security;
alter table pcm.sso_publicacao_pendencia_mediada_gate force row level security;
revoke all on pcm.sso_publicacao_pendencia_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_exigir_publicacao_pendencia_mediada(p_ator_id uuid,p_cliente_id uuid,p_escrita boolean) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_publicacao_pendencia_mediada_gate where id and case when p_escrita then escrita else leitura end for share;
 if not found then raise exception 'acao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.portal_pendencia_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_publicacao_pendencia_mediada(uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_portal_pendencias_os_mediada(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos uuid)
returns table(id uuid,alvo text,descricao text,estado text,publicado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_publicacao_pendencia_mediada_gate where id and portal for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.portal_pendencia_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=p_ator_id and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico' for share of uc,u;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where pcm.ordens_servico.id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_portal_pendencias_os(p_cliente_id,p_os_id,p_apos);
end; $$;
revoke all on function pcm.sso_portal_pendencias_os_mediada(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_pendencias_os_mediada(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_listar_publicacoes_pendencia_mediada(p_ator_id uuid,p_cliente_id uuid,p_pendencia_id uuid,p_apos uuid)
returns table(id uuid,revisao integer,alvo text,descricao text,estado text,publicado_em timestamptz,revogado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_publicacao_pendencia_mediada(p_ator_id,p_cliente_id,false);
 return query select * from pcm.sso_listar_publicacoes_pendencia(p_cliente_id,p_pendencia_id,p_apos);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_publicacoes_pendencia_mediada(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_publicacoes_pendencia_mediada(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_publicar_pendencia_portal_mediada(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_pendencia_id uuid,p_revisao integer,p_alvo text,p_descricao text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;
begin
 perform pcm.sso_exigir_publicacao_pendencia_mediada(p_ator_id,p_cliente_id,true);
 if not exists(select 1 from pcm.sso_pendencias_tecnicas p where p.id=p_pendencia_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_id:=pcm.sso_publicar_pendencia_portal_v2(p_request_id,p_pendencia_id,p_revisao,p_alvo,p_descricao);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_id;
end; $$;
revoke all on function pcm.sso_publicar_pendencia_portal_mediada(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_publicar_pendencia_portal_mediada(uuid,uuid,uuid,uuid,integer,text,text) to authenticated;

create function pcm.sso_revogar_pendencia_portal_mediada(p_ator_id uuid,p_cliente_id uuid,p_publicacao_id uuid,p_motivo text) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_publicacao_pendencia_mediada(p_ator_id,p_cliente_id,true);
 if not exists(select 1 from pcm.portal_pendencia_publicacoes p where p.id=p_publicacao_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pcm.sso_revogar_pendencia_portal(p_publicacao_id,p_motivo);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_revogar_pendencia_portal_mediada(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_revogar_pendencia_portal_mediada(uuid,uuid,uuid,text) to authenticated;
