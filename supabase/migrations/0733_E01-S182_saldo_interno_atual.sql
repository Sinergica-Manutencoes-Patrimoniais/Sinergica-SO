-- ADR-0508: projeção de saldo, sem escrever ou faturar.
create function financeiro.sso_saldo_documento_interno(p_cliente_id uuid,p_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype; alocado numeric; reservado numeric; saldo numeric;
begin
  if not coalesce((select habilitado from financeiro.sso_selecao_documento_gate where id),false) or not coalesce((select habilitado from financeiro.sso_documento_interno_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  if i.valor_conferido_centavos is null then return jsonb_build_object('itemId',i.id,'revisao',i.revisao,'situacao','nao_conferido','conferidoCentavos',null,'alocadoCentavos',null,'reservadoCentavos',null,'disponivelCentavos',null); end if;
  select coalesce(sum(a.valor_centavos) filter(where e.id is null),0) into alocado from financeiro.sso_faturavel_alocacoes a left join financeiro.sso_faturavel_estornos e on e.alocacao_id=a.id where a.item_id=i.id;
  select coalesce(sum(d.valor_centavos),0) into reservado from financeiro.sso_documentos_internos d where d.item_id=i.id and d.cliente_id=p_cliente_id
    and not exists(select 1 from financeiro.sso_documentos_internos_liberacoes l where l.documento_interno_id=d.id);
  saldo:=i.valor_conferido_centavos-alocado-reservado;
  return jsonb_build_object('itemId',i.id,'revisao',i.revisao,'situacao',case when saldo<0 then 'divergente' else 'calculado' end,
    'conferidoCentavos',i.valor_conferido_centavos::text,'alocadoCentavos',alocado::text,'reservadoCentavos',reservado::text,'disponivelCentavos',saldo::text);
end $$;
revoke all on function financeiro.sso_saldo_documento_interno(uuid,uuid) from public,anon,authenticated,service_role;
