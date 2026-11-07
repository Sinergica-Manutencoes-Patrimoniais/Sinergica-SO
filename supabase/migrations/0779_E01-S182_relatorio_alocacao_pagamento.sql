-- ADR-0554: não inferir liquidação bancária nem soma entre medidas.
create function financeiro.sso_relatorio_alocacao_pagamento(p_cliente_id uuid,p_competencia date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare qtd bigint; bruto numeric; estornado numeric; documentos bigint; realizados bigint; valor_realizado numeric; desconhecidos bigint;
begin
  if not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_competencia is null or not isfinite(p_competencia) or extract(day from p_competencia)<>1
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*),coalesce(sum(a.valor_centavos),0),coalesce(sum(a.valor_centavos) filter(where e.id is not null),0) into qtd,bruto,estornado
    from financeiro.sso_faturavel_alocacoes a join financeiro.itens_faturaveis i on i.id=a.item_id and i.cliente_id=p_cliente_id and i.competencia=p_competencia
    left join financeiro.sso_faturavel_estornos e on e.alocacao_id=a.id;
  with docs as (select distinct a.documento_id from financeiro.sso_faturavel_alocacoes a join financeiro.itens_faturaveis i on i.id=a.item_id
    where i.cliente_id=p_cliente_id and i.competencia=p_competencia)
  select count(*),count(*) filter(where l.status='realizado' and l.data_pagamento is not null),
    coalesce(sum(l.valor_centavos) filter(where l.status='realizado' and l.data_pagamento is not null),0),
    count(*) filter(where d.id is null or l.id is null or l.status is null or (l.status='realizado' and l.data_pagamento is null))
    into documentos,realizados,valor_realizado,desconhecidos from docs x
    left join financeiro.sso_faturavel_documentos d on d.id=x.documento_id and d.cliente_id=p_cliente_id
    left join financeiro.lancamentos l on l.id=d.lancamento_id and l.cliente_id=p_cliente_id;
  return jsonb_build_object('competencia',p_competencia,'alocacoes',qtd,'alocadoBrutoCentavos',bruto::text,'estornadoCentavos',estornado::text,
    'documentos',documentos,'lancamentosRealizadosComData',realizados,'valorIntegralLancamentosRealizadosCentavos',valor_realizado::text,'situacaoLocalDesconhecida',desconhecidos,
    'confirmaLiquidacaoBancaria',false,'medidasSomaveisEntreSi',false);
end $$;
revoke all on function financeiro.sso_relatorio_alocacao_pagamento(uuid,date) from public,anon,authenticated,service_role;
