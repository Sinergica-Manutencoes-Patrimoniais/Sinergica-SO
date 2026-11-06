-- ADR-1390: declaração e histórico mediados; sem efeito externo.
create table pcm.sso_quantidade_grupo_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_quantidade_grupo_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_quantidade_grupo_mediada_gate enable row level security;
alter table pcm.sso_quantidade_grupo_mediada_gate force row level security;
revoke all on pcm.sso_quantidade_grupo_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_atestados_grupo_mediada(p_cliente_id uuid,p_ocorrencia_id uuid,p_antes integer,p_limite integer)
returns table(request_id uuid,revisao integer,os_id uuid,declaracao text,referencia_evidencia text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_quantidade_grupo_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_atestado_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_atestados_grupo(p_cliente_id,p_ocorrencia_id,p_antes,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_atestados_grupo_mediada(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_atestados_grupo_mediada(uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_listar_quantidades_grupo_mediada(p_cliente_id uuid,p_ocorrencia_id uuid,p_antes integer,p_limite integer)
returns table(request_id uuid,os_id uuid,atestado_request_id uuid,revisao integer,quantidade_declarada text,quantidade_snapshot text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_quantidade_grupo_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_quantidade_declarada_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_quantidades_grupo(p_cliente_id,p_ocorrencia_id,p_antes,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_quantidades_grupo_mediada(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_quantidades_grupo_mediada(uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_declarar_quantidade_grupo_mediada(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_atestado_id uuid,p_expected_revision integer,p_quantidade text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_quantidade_grupo_mediada_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_quantidade_declarada_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_declarar_quantidade_grupo(p_request_id,p_cliente_id,p_ocorrencia_id,p_atestado_id,p_expected_revision,p_quantidade,p_motivo);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_quantidade_grupo_mediada(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_quantidade_grupo_mediada(uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
