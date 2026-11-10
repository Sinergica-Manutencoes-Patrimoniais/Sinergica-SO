-- ADR-0515: diferenças para conferência, sem inferir erro contábil.
create function financeiro.sso_conferir_datas_documentos(p_cliente_id uuid,p_competencia date,p_apos uuid,p_limite integer)
returns table(alocacao_id uuid,item_id uuid,competencia_item date,data_documento date,competencia_lancamento date,situacao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_competencia is null or not isfinite(p_competencia) or extract(day from p_competencia)<>1
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select a.id,i.id,i.competencia,d.data_documento,date_trunc('month',l.data_competencia)::date,
    case when d.id is null then 'documento_indisponivel_ou_fora_escopo' when l.id is null then 'lancamento_indisponivel_ou_fora_escopo'
      when date_trunc('month',d.data_documento)::date is distinct from i.competencia or date_trunc('month',l.data_competencia)::date is distinct from i.competencia then 'meses_diferentes_conferir'
      else 'meses_coincidentes' end::text
    from financeiro.sso_faturavel_alocacoes a join financeiro.itens_faturaveis i on i.id=a.item_id and i.cliente_id=p_cliente_id and i.competencia=p_competencia
    left join financeiro.sso_faturavel_documentos d on d.id=a.documento_id and d.cliente_id=p_cliente_id
    left join financeiro.lancamentos l on l.id=d.lancamento_id and l.cliente_id=p_cliente_id
    where p_apos is null or a.id>p_apos order by a.id limit p_limite;
end $$;
revoke all on function financeiro.sso_conferir_datas_documentos(uuid,date,uuid,integer) from public,anon,authenticated,service_role;
