-- ADR-1210: consulta do recibo, sem nova OS ou efeito externo.
create function pcm.sso_consultar_recibo_continuacao_parcela(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_chamado_id uuid,
  p_chamado_revision bigint,p_parcela_id uuid,p_proposta_id uuid,p_proposta_sha256 text,p_os_anterior_id uuid,p_os_atualizada_em timestamptz,p_os_nova_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_recibo pcm.sso_continuacoes_os_parcela%rowtype; v_payload jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_chamado_id is null
    or p_chamado_revision is null or p_chamado_revision < 1 or p_parcela_id is null or p_proposta_id is null or p_os_anterior_id is null
    or p_os_nova_id is null or p_os_atualizada_em is null or not isfinite(p_os_atualizada_em)
    or p_proposta_sha256 is null or p_proposta_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_continuacao_os_parcela_gate where id and habilitado for share;
  if not found then raise exception 'continuacao_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  perform 1 from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  perform 1 from pcm.ordens_servico where id=p_os_nova_id and chamado_id=p_chamado_id and client_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'chamadoRevision',p_chamado_revision,'parcelaId',p_parcela_id,
    'propostaId',p_proposta_id,'propostaSha256',p_proposta_sha256,'osAnteriorId',p_os_anterior_id,'osAtualizadaEm',p_os_atualizada_em,'osNovaId',p_os_nova_id);
  select * into v_recibo from pcm.sso_continuacoes_os_parcela where request_id=p_request_id and ator_id=p_ator_id and cliente_id=p_cliente_id and payload=v_payload;
  if not found then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return v_recibo.resultado;
end; $$;
revoke all on function pcm.sso_consultar_recibo_continuacao_parcela(uuid,uuid,uuid,uuid,bigint,uuid,uuid,text,uuid,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_recibo_continuacao_parcela(uuid,uuid,uuid,uuid,bigint,uuid,uuid,text,uuid,timestamptz,uuid) to authenticated;
