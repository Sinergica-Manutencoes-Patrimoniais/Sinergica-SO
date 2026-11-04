-- ADR-1190: entrada mediada; consulta original permanece privada.
create function pcm.sso_listar_resultados_ativo_mediada(p_ator_id uuid,p_cliente_id uuid,p_alvo_tipo text,p_alvo_id uuid,p_apos uuid,p_limite integer)
returns table(resposta_id uuid,retorno_id uuid,os_id uuid,chave_pergunta text,resultado text,observacao text,fotos_registradas bigint,decisao_retorno text)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_alvo_id is null or p_alvo_tipo is null
    or p_alvo_tipo not in ('sistema','componente','grupo') or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_resultados_ativo_gate where id and habilitado for share;
  if not found then raise exception 'resultados_desabilitados' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select * from pcm.sso_listar_resultados_ativo(p_cliente_id,p_alvo_tipo,p_alvo_id,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_resultados_ativo_mediada(uuid,uuid,text,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_resultados_ativo_mediada(uuid,uuid,text,uuid,uuid,integer) to authenticated;
