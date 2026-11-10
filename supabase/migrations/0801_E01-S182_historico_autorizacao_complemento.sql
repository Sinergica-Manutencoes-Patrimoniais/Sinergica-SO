-- ADR-0576: histórico paginado sem mutação ou cobrança.
create function financeiro.sso_historico_autorizacao_complemento(p_cliente_id uuid,p_proposta_id uuid,p_item_id uuid,p_antes timestamptz,p_antes_id uuid,p_limite integer)
returns table(autorizacao_id uuid,revisao_item integer,versao_proposta integer,modo text,valor_centavos text,motivo text,criado_em timestamptz,revogada boolean,motivo_revogacao text,revogada_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from financeiro.sso_autorizacao_complemento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_proposta_id is null or p_item_id is null or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
    or not exists(select 1 from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id and item_base_id is not null)
    or not exists(select 1 from comercial.proposta_origens_operacionais o join pcm.listas_materiais lm on lm.id=o.lista_materiais_id and lm.cliente_id=p_cliente_id and lm.ordem_servico_id=o.ordem_servico_id
      join pcm.ordens_servico os on os.id=o.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null where o.proposta_id=p_proposta_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or ((p_antes is null)<>(p_antes_id is null)) or (p_antes is not null and not isfinite(p_antes)) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select a.id,a.revisao_item,a.versao_proposta,a.modo,a.valor_centavos::text,a.motivo,a.criado_em,(r.request_id is not null),r.motivo,r.criado_em
    from financeiro.sso_autorizacoes_complemento a left join financeiro.sso_revogacoes_autorizacao_complemento r on r.autorizacao_id=a.id
    where a.cliente_id=p_cliente_id and a.proposta_id=p_proposta_id and a.item_id=p_item_id and (p_antes is null or (a.criado_em,a.id)<(p_antes,p_antes_id))
    order by a.criado_em desc,a.id desc limit p_limite;
end $$;
revoke all on function financeiro.sso_historico_autorizacao_complemento(uuid,uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
