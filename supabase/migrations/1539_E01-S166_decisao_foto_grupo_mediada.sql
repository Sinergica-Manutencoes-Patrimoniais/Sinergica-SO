-- ADR-1393: decisão PCM sobre foto continua declarativa.
create table pcm.sso_decisao_foto_grupo_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_decisao_foto_grupo_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_decisao_foto_grupo_mediada_gate enable row level security;
alter table pcm.sso_decisao_foto_grupo_mediada_gate force row level security;
revoke all on pcm.sso_decisao_foto_grupo_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_decisoes_foto_grupo_mediada(p_cliente_id uuid,p_ocorrencia_id uuid,p_antes integer,p_limite integer)
returns table(request_id uuid,foto_id uuid,revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_decisao_foto_grupo_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_decisao_foto_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_decisoes_foto_grupo(p_cliente_id,p_ocorrencia_id,p_antes,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_decisoes_foto_grupo_mediada(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_decisoes_foto_grupo_mediada(uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_decidir_foto_grupo_mediada(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_foto_id uuid,p_expected_revision integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_decisao_foto_grupo_mediada_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_decisao_foto_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_foto_grupo_gate where id and habilitado for share;
 if not found then raise exception 'foto_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_decidir_foto_grupo(p_request_id,p_cliente_id,p_ocorrencia_id,p_foto_id,p_expected_revision,p_decisao,p_motivo);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_foto_grupo_mediada(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_foto_grupo_mediada(uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
