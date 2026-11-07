-- ADR-1451: leitura autorizada do histórico sem abrir o núcleo privado.
create function pcm.sso_listar_atestacoes_pcm_mediada(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,condicao_evidencia_id uuid,decisao_id uuid,revisao_decisao integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_classificacao_retorno_mediada_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_atestacao_pcm_gate where id and habilitado for share;
 if not found then raise exception 'atestacao_pcm_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_retorno_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_atestacoes_pcm_retorno(p_cliente_id,p_retorno_id,p_apos,p_limite);
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_atestacoes_pcm_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_atestacoes_pcm_mediada(uuid,uuid,uuid,integer) to authenticated;
