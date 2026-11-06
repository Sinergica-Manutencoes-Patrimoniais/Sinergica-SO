-- ADR-1409: acesso autenticado às leituras privadas, sem expor caminho de Storage.
create table pcm.sso_evidencia_origem_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_evidencia_origem_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_evidencia_origem_mediada_gate enable row level security;
alter table pcm.sso_evidencia_origem_mediada_gate force row level security;
revoke all on pcm.sso_evidencia_origem_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_evidencias_origem_mediada(p_ator_id uuid,p_cliente_id uuid,p_pendencia_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,revisao integer,mime_declarado text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_pendencia_id is null or p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_evidencia_origem_mediada_gate where id and habilitado for share;
 if not found then raise exception 'evidencia_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_pendencias_tecnicas p where p.id=p_pendencia_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_evidencias_origem_pendencia(p_pendencia_id,p_antes,p_limite);
end; $$;
revoke all on function pcm.sso_listar_evidencias_origem_mediada(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_evidencias_origem_mediada(uuid,uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_decisao_foto_origem_mediada(p_ator_id uuid,p_cliente_id uuid,p_pendencia_id uuid,p_evidencia_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_pendencia_id is null or p_evidencia_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_evidencia_origem_mediada_gate where id and habilitado for share;
 if not found then raise exception 'evidencia_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_pendencias_tecnicas p where p.id=p_pendencia_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return pcm.sso_decisao_foto_origem_pendencia(p_pendencia_id,p_evidencia_id);
end; $$;
revoke all on function pcm.sso_decisao_foto_origem_mediada(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decisao_foto_origem_mediada(uuid,uuid,uuid,uuid) to authenticated;
