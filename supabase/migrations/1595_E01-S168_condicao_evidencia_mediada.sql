-- ADR-1452: entradas autenticadas preservam os núcleos e gates de evidência.
create function pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id uuid,p_retorno_id uuid,p_escrita boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_classificacao_retorno_mediada_gate where id and case when p_escrita then escrita else leitura end for share;
 if not found then raise exception 'condicao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_retorno_id is null or p_escrita is null
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
   or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_guardar_condicao_evidencia_mediada(uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_checar_evidencias_mediada(p_cliente_id uuid,p_retorno_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 v_resultado:=pcm.sso_checar_evidencias_snapshot(p_cliente_id,p_retorno_id);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_checar_evidencias_mediada(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_checar_evidencias_mediada(uuid,uuid) to authenticated;

create function pcm.sso_listar_condicoes_evidencia_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,condicao_estrutural_id uuid,revisao_evidencias integer,revisao_decisao integer,decisoes_resposta bigint,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_condicoes_evidencia_retorno(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_condicoes_evidencia_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_condicoes_evidencia_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_registrar_condicao_evidencias_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_expected_evidencias integer,p_expected_decisao integer,p_justificativa text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_registrar_condicao_evidencias_retorno(p_request_id,p_cliente_id,p_retorno_id,p_conferencia_id,p_expected_evidencias,p_expected_decisao,p_justificativa);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_registrar_condicao_evidencias_mediada(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_registrar_condicao_evidencias_mediada(uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;
