-- ADR-1456: entradas autenticadas mantêm os núcleos de evidência privados.
create function pcm.sso_listar_retornos_declarados_mediada(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(retorno_id uuid,os_id uuid,envelope_id uuid,revisao_evidencias integer)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_classificacao_retorno_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_retornos_declarados(p_cliente_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_retornos_declarados_mediada(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_retornos_declarados_mediada(uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_evidencias_declaradas_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos integer,p_limite integer)
returns table(id uuid,revisao integer,tipo text,referencia text,descricao text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,false);
 return query select * from pcm.sso_listar_evidencias_declaradas(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_evidencias_declaradas_mediada(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_evidencias_declaradas_mediada(uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_anotar_evidencia_retorno_mediada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_evidencia_id uuid,p_expected_revision integer,p_tipo text,p_referencia text,p_descricao text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 perform pcm.sso_guardar_condicao_evidencia_mediada(p_cliente_id,p_retorno_id,true);
 v_resultado:=pcm.sso_anotar_evidencia_retorno(p_request_id,p_cliente_id,p_retorno_id,p_evidencia_id,p_expected_revision,p_tipo,p_referencia,p_descricao);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_anotar_evidencia_retorno_mediada(uuid,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_anotar_evidencia_retorno_mediada(uuid,uuid,uuid,uuid,integer,text,text,text) to authenticated;
