-- ADR-1072. Consulta e comando condicionados aos gates existentes.
create function pcm.sso_consultar_continuacao_parcela_conferida(p_ator_id uuid,p_cliente_id uuid,p_chamado_id uuid,p_proposta_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_c pcm.chamados%rowtype;v_proposta pcm.chamado_continuacoes_propostas%rowtype;v_os pcm.ordens_servico%rowtype;v_parcela uuid;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_chamado_id is null or p_proposta_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_continuacao_os_parcela_gate where id and habilitado for share;
  if not found then raise exception 'continuacao_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_c from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  select * into v_proposta from pcm.chamado_continuacoes_propostas where id=p_proposta_id and chamado_id=p_chamado_id and situacao='pendente';
  if not found then raise exception 'proposta_indisponivel' using errcode='23514'; end if;
  select * into v_os from pcm.ordens_servico where id=v_proposta.os_anterior_id and chamado_id=p_chamado_id and client_id=p_cliente_id and deleted_at is null and status='finalizado';
  if not found or v_os.updated_at is null then raise exception 'os_indisponivel' using errcode='23514'; end if;
  if (select count(*) from pcm.sso_parcelas_da_os_cadeia(p_cliente_id,p_chamado_id,v_os.id))<>1 then raise exception 'atribuicao_ambigua' using errcode='23514'; end if;
  select parcela_id into v_parcela from pcm.sso_parcelas_da_os_cadeia(p_cliente_id,p_chamado_id,v_os.id);
  if exists(select 1 from pcm.sso_continuacoes_os_parcela where parcela_id=v_parcela and os_anterior_id=v_os.id) then raise exception 'continuacao_ja_criada' using errcode='23514'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'revision',v_c.sso_revisao,'parcelaId',v_parcela,'propostaId',p_proposta_id,
    'propostaSha256',encode(sha256(convert_to(to_jsonb(v_proposta)::text,'UTF8')),'hex'),'osAnteriorId',v_os.id,'osAtualizadaEm',v_os.updated_at,
    'descricaoRestante',v_proposta.descricao_restante,'minutosRestantes',v_proposta.minutos_restantes,'execucaoComprovada',false);
end; $$;
revoke all on function pcm.sso_consultar_continuacao_parcela_conferida(uuid,uuid,uuid,uuid),pcm.sso_aprovar_continuacao_parcela_conferida(uuid,uuid,uuid,uuid,bigint,uuid,uuid,text,uuid,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_continuacao_parcela_conferida(uuid,uuid,uuid,uuid),pcm.sso_aprovar_continuacao_parcela_conferida(uuid,uuid,uuid,uuid,bigint,uuid,uuid,text,uuid,timestamptz,uuid) to authenticated;
