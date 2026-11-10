-- ADR-0510: histórico somente leitura, escopo por Cliente e item.
create function financeiro.sso_historico_documentos_internos(p_cliente_id uuid,p_item_id uuid,p_antes timestamptz,p_antes_id uuid,p_limite integer)
returns table(documento_id uuid,revisao_item integer,valor_centavos text,criado_em timestamptz,estado text,alocacao_id uuid,alocacao_centavos text,alocacao_estornada boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from financeiro.sso_selecao_documento_gate where id),false) or not coalesce((select habilitado from financeiro.sso_documento_interno_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or not exists(select 1 from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or ((p_antes is null)<>(p_antes_id is null)) or (p_antes is not null and not isfinite(p_antes)) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select d.id,d.revisao_item,d.valor_centavos::text,d.criado_em,
    case when l.request_id is null then 'reservado' when l.acao='liberar' then 'liberado' else 'convertido' end,
    a.id,a.valor_centavos::text,case when a.id is null then false else e.id is not null end
    from financeiro.sso_documentos_internos d left join financeiro.sso_documentos_internos_liberacoes l on l.documento_interno_id=d.id
    left join financeiro.sso_faturavel_alocacoes a on l.acao='converter' and a.request_id=l.request_id and a.item_id=d.item_id
    left join financeiro.sso_faturavel_estornos e on e.alocacao_id=a.id
    where d.cliente_id=p_cliente_id and d.item_id=p_item_id and (p_antes is null or (d.criado_em,d.id)<(p_antes,p_antes_id))
    order by d.criado_em desc,d.id desc limit p_limite;
end $$;
revoke all on function financeiro.sso_historico_documentos_internos(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
