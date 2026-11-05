-- ADR-1388: intenção e decisão permanecem separadas de qualquer execução.
create table pcm.sso_intencao_grupo_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_intencao_grupo_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_intencao_grupo_mediada_gate enable row level security;
alter table pcm.sso_intencao_grupo_mediada_gate force row level security;
revoke all on pcm.sso_intencao_grupo_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_consultar_intencao_grupo_mediada(p_cliente_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_intencao_grupo_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_intencao_os_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_consultar_intencao_os_grupo(p_cliente_id,p_ocorrencia_id);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_consultar_intencao_grupo_mediada(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_intencao_grupo_mediada(uuid,uuid) to authenticated;

create function pcm.sso_preparar_intencao_grupo_mediada(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_titulo text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_intencao_grupo_mediada_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_intencao_os_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_request_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_preparar_intencao_os_grupo(p_request_id,p_cliente_id,p_ocorrencia_id,p_titulo,p_motivo);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_preparar_intencao_grupo_mediada(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_preparar_intencao_grupo_mediada(uuid,uuid,uuid,text,text) to authenticated;

create function pcm.sso_decidir_intencao_grupo_mediada(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_intencao_id uuid,p_os_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_intencao_grupo_mediada_gate where id and escrita for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_reconciliacao_intencao_grupo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_request_id is null or p_ocorrencia_id is null or p_intencao_id is null or p_os_id is null
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
   or not exists(select 1 from pcm.sso_intencoes_os_grupo i where i.id=p_intencao_id and i.ocorrencia_grupo_id=p_ocorrencia_id and i.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_decidir_vinculo_intencao_grupo(p_request_id,p_cliente_id,p_intencao_id,p_os_id,p_motivo);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_intencao_grupo_mediada(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_intencao_grupo_mediada(uuid,uuid,uuid,uuid,uuid,text) to authenticated;
