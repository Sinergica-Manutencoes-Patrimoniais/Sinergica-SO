-- ADR-1447: entradas autenticadas sem conceder diretamente os núcleos privados.
create table pcm.sso_classificacao_retorno_mediada_gate(id boolean primary key default true check(id),leitura boolean not null default false,escrita boolean not null default false);
insert into pcm.sso_classificacao_retorno_mediada_gate(id,leitura,escrita) values(true,false,false);
alter table pcm.sso_classificacao_retorno_mediada_gate enable row level security;
alter table pcm.sso_classificacao_retorno_mediada_gate force row level security;
revoke all on pcm.sso_classificacao_retorno_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_retornos_classificaveis_mediada(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(envelope_id uuid,resolucao_id uuid,os_id uuid,task_id text,ocorrido_em timestamptz,recebido_em timestamptz,perguntas jsonb)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_classificacao_retorno_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_envelopes_classificaveis(p_cliente_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_retornos_classificaveis_mediada(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_retornos_classificaveis_mediada(uuid,uuid,integer) to authenticated;

create function pcm.sso_classificar_retorno_campo_mediada(p_request_id uuid,p_cliente_id uuid,p_envelope_id uuid,p_resolucao_id uuid,p_retorno_id uuid,p_respostas jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_classificacao_retorno_mediada_gate where id and escrita for share;
 if not found then raise exception 'classificacao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_classificar_retorno_campo_manual(p_request_id,p_cliente_id,p_envelope_id,p_resolucao_id,p_retorno_id,p_respostas);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_classificar_retorno_campo_mediada(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_classificar_retorno_campo_mediada(uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;
