-- ADR-0280: consulta de alocações existentes, sem efeito financeiro.
create function financeiro.sso_documentos_competencia(p_cliente_id uuid,p_competencia date,p_apos uuid default null)
returns table(alocacao_id uuid,documento_id uuid,referencia text,data_documento date,item_id uuid,valor_centavos text,estornada boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_competencia is null or not isfinite(p_competencia) or extract(day from p_competencia)<>1
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  return query select a.id,d.id,d.referencia,d.data_documento,i.id,a.valor_centavos::text,(e.id is not null)
    from financeiro.sso_faturavel_alocacoes a join financeiro.itens_faturaveis i on i.id=a.item_id and i.cliente_id=p_cliente_id and i.competencia=p_competencia
    join financeiro.sso_faturavel_documentos d on d.id=a.documento_id and d.cliente_id=p_cliente_id
    left join financeiro.sso_faturavel_estornos e on e.alocacao_id=a.id
    where p_apos is null or a.id>p_apos order by a.id limit 20;
end $$;
revoke all on function financeiro.sso_documentos_competencia(uuid,date,uuid) from public,anon,authenticated,service_role;
