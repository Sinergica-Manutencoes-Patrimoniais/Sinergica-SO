-- ADR-0284: diagnóstico, não cria documentos nem define obrigatoriedade de alocação.
create function financeiro.sso_diagnostico_documentos_competencia(p_cliente_id uuid,p_competencia date,p_apos uuid default null)
returns table(lancamento_id uuid,descricao text,valor_centavos text,data_competencia date,documento_ref text,situacao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_competencia is null or not isfinite(p_competencia) or extract(day from p_competencia)<>1
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  return query select l.id,coalesce(l.descricao,''),l.valor_centavos::text,l.data_competencia,d.referencia,
    case when d.id is null then 'sem_documento_sso' else 'sem_alocacao_ativa' end
    from financeiro.lancamentos l left join financeiro.sso_faturavel_documentos d on d.lancamento_id=l.id and d.cliente_id=p_cliente_id
    where l.cliente_id=p_cliente_id and l.tipo='entrada' and l.data_competencia>=p_competencia
      and l.data_competencia<(p_competencia + interval '1 month')::date and (p_apos is null or l.id>p_apos)
      and not exists(select 1 from financeiro.sso_faturavel_alocacoes a left join financeiro.sso_faturavel_estornos e on e.alocacao_id=a.id
        where a.documento_id=d.id and e.id is null)
    order by l.id limit 20;
end $$;
revoke all on function financeiro.sso_diagnostico_documentos_competencia(uuid,date,uuid) from public,anon,authenticated,service_role;
