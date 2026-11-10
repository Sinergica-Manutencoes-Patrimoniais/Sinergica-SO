-- ADR-1431: consulta sem repetir escrita, com a mesma trava do comando.
create function pcm.sso_consultar_edicao_composicao(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_expected_versao integer,
 p_snapshot text,p_itens jsonb,p_preco_centavos bigint,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_comando pcm.sso_edicoes_composicao_escopadas%rowtype;v_payload jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 perform 1 from pcm.sso_edicao_composicao_escopada_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if p_request_id is null or p_cliente_id is null or p_proposta_id is null or p_expected_versao is null or p_expected_versao<1
   or p_snapshot is null or p_snapshot !~ '^[0-9a-f]{32}$' or jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens)>100
   or p_preco_centavos is null or p_preco_centavos<0 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_consultar_custos_proposta(p_cliente_id,p_proposta_id);
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('composicao-escopada:'||p_request_id::text,0)) then
   return jsonb_build_object('requestId',p_request_id,'situacao','em_andamento'); end if;
 select * into v_comando from pcm.sso_edicoes_composicao_escopadas where request_id=p_request_id;
 if not found then return jsonb_build_object('requestId',p_request_id,'situacao','nao_localizada'); end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'propostaId',p_proposta_id,'versao',p_expected_versao,'snapshot',p_snapshot,'itens',p_itens,'preco',p_preco_centavos,'motivo',btrim(p_motivo));
 if v_comando.ator_id is distinct from auth.uid() or v_comando.cliente_id is distinct from p_cliente_id or v_comando.proposta_id is distinct from p_proposta_id or v_comando.payload is distinct from v_payload then raise exception 'sem_acesso_ou_conflito' using errcode='42501'; end if;
 return jsonb_build_object('requestId',p_request_id,'situacao','confirmada','resultado',v_comando.resultado);
end; $$;
revoke all on function pcm.sso_consultar_edicao_composicao(uuid,uuid,uuid,integer,text,jsonb,bigint,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_edicao_composicao(uuid,uuid,uuid,integer,text,jsonb,bigint,text) to authenticated;
