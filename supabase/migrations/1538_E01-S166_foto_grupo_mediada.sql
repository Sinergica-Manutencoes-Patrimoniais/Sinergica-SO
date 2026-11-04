-- ADR-1392: metadados e declaração mediados; não distribui arquivos.
create table pcm.sso_foto_atestado_grupo_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_foto_atestado_grupo_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_foto_atestado_grupo_mediada_gate enable row level security;
alter table pcm.sso_foto_atestado_grupo_mediada_gate force row level security;
revoke all on pcm.sso_foto_atestado_grupo_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_fotos_candidatas_grupo_mediada(p_cliente_id uuid,p_ocorrencia_id uuid,p_apos uuid,p_limite integer)
returns table(nota_id uuid,os_id uuid,mime_declarado text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_atestado_grupo_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_foto_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_fotos_candidatas_grupo(p_cliente_id,p_ocorrencia_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_fotos_candidatas_grupo_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_candidatas_grupo_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_fotos_atestado_grupo_mediada(p_cliente_id uuid,p_ocorrencia_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,atestado_request_id uuid,nota_id uuid,revisao integer,mime_declarado text,justificativa text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_atestado_grupo_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_foto_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_fotos_atestado_grupo(p_cliente_id,p_ocorrencia_id,p_antes,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_fotos_atestado_grupo_mediada(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_atestado_grupo_mediada(uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_registrar_foto_atestado_grupo_mediada(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_atestado_id uuid,p_nota_id uuid,p_expected_revision integer,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_atestado_grupo_mediada_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_foto_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_registrar_foto_atestado_grupo(p_request_id,p_cliente_id,p_ocorrencia_id,p_atestado_id,p_nota_id,p_expected_revision,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_registrar_foto_atestado_grupo_mediada(uuid,uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_registrar_foto_atestado_grupo_mediada(uuid,uuid,uuid,uuid,uuid,integer,text) to authenticated;
