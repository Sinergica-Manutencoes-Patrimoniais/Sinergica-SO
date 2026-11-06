-- ADR-0543: histórico próprio, sem payload e sem executar operação.
create function financeiro.sso_listar_pedidos_alocacao_proprios(p_cliente_id uuid,p_item_id uuid,p_antes timestamptz,p_antes_id uuid,p_limite integer)
returns table(request_id uuid,criado_em timestamptz,situacao text,alocacao_id uuid,documento_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from financeiro.sso_recuperar_parcela_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or not exists(select 1 from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or ((p_antes is null)<>(p_antes_id is null)) or (p_antes is not null and not isfinite(p_antes)) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select c.request_id,c.criado_em,case when a.id is null then 'inconsistente_investigar' else 'alocacao_registrada' end::text,a.id,a.documento_id
    from financeiro.sso_faturavel_comandos c left join financeiro.sso_faturavel_alocacoes a on a.request_id=c.request_id and a.item_id=p_item_id
    where c.ator_id=auth.uid() and c.payload->>'operacao'='alocar_documento' and c.payload->>'itemId'=p_item_id::text
      and (p_antes is null or (c.criado_em,c.request_id)<(p_antes,p_antes_id)) order by c.criado_em desc,c.request_id desc limit p_limite;
end $$;
revoke all on function financeiro.sso_listar_pedidos_alocacao_proprios(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
