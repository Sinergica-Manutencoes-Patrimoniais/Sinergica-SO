-- ADR-0583: fail-closed para conferência nova enquanto falta prova aplicável.
alter function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) rename to sso_conferencia_base_0808;
revoke all on function financeiro.sso_conferencia_base_0808(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
create function financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id uuid,p_item_id uuid,p_expected_revision integer,p_acao text,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype;
begin
  if p_acao is distinct from 'conferir' or not coalesce((select habilitado from financeiro.sso_exigir_autorizacao_complemento_gate where id),false) then return financeiro.sso_conferencia_base_0808(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo); end if;
  if auth.uid() is null or p_request_id is null or p_item_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into i from financeiro.itens_faturaveis where id=p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if exists(select 1 from financeiro.sso_faturavel_comandos where request_id=p_request_id) or i.item_base_id is null or i.origem_tipo not in ('proposta_operacional','material_proposta_linha') then
    return financeiro.sso_conferencia_base_0808(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
  end if;
  raise exception 'regra_ou_aceite_adicional_nao_comprovado' using errcode='55000';
end $$;
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;

create function financeiro.sso_diagnostico_aceite_complemento(p_cliente_id uuid,p_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype; interna boolean;
begin
  if not coalesce((select habilitado from financeiro.sso_autorizacao_complemento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null or (config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true and config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id and item_base_id is not null and origem_tipo in ('proposta_operacional','material_proposta_linha');
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select exists(select 1 from financeiro.sso_autorizacoes_complemento a where a.item_id=i.id and a.cliente_id=p_cliente_id and a.revisao_item=i.revisao
    and not exists(select 1 from financeiro.sso_revogacoes_autorizacao_complemento r where r.autorizacao_id=a.id)) into interna;
  return jsonb_build_object('itemId',i.id,'revisao',i.revisao,'autorizacaoInterna',interna,'regraContratual','nao_comprovada','aceiteAdicional','nao_comprovado','autorizaConferencia',false);
end $$;
revoke all on function financeiro.sso_diagnostico_aceite_complemento(uuid,uuid) from public,anon,authenticated,service_role;
