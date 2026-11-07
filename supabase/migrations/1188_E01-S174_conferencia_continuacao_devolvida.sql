-- ADR-1036: consulta de contexto, sem registrar decisão nem autorizar encerramento.
create function pcm.sso_conferir_continuacao_devolvida(p_ator_id uuid,p_cliente_id uuid,p_retorno_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_retorno pcm.sso_retornos_parciais%rowtype;v_proposta pcm.chamado_continuacoes_propostas%rowtype;v_revision bigint;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_retorno_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_continuacao_devolvida_gate where id and habilitado for share;
  if not found then raise exception 'continuacao_devolvida_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_retorno from pcm.sso_retornos_parciais where id=p_retorno_id and cliente_id=p_cliente_id;
  if not found then raise exception 'retorno_indisponivel' using errcode='42501'; end if;
  select c.sso_revisao into v_revision from pcm.chamados c where c.id=v_retorno.chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  select * into v_proposta from pcm.chamado_continuacoes_propostas where id=v_retorno.proposta_id and chamado_id=v_retorno.chamado_id;
  if not found then raise exception 'proposta_indisponivel' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'chamadoId',v_retorno.chamado_id,
    'propostaId',v_proposta.id,'revision',v_revision,'estadoRetorno',v_retorno.estado,'situacaoProposta',v_proposta.situacao,
    'descricaoRestante',v_retorno.descricao_restante,'minutosRestantes',v_retorno.minutos_restantes,'paradaComprovada',false);
end;
$$;
revoke all on function pcm.sso_conferir_continuacao_devolvida(uuid,uuid,uuid) from public,anon,authenticated,service_role;
