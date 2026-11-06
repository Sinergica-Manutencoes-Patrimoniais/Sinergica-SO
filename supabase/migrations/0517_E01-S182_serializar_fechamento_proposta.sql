-- ADR-0291: wrapper fechado; lock na mesma ordem dos comandos S182 existentes.
create function financeiro.sso_reconhecer_proposta_com_fechamento(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,
  p_versao integer,p_valor_centavos bigint,p_competencia date)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_proposta_faturavel_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  lock table financeiro.fechamentos_mensais in share mode;
  return financeiro.sso_reconhecer_proposta_aceita(p_request_id,p_cliente_id,p_proposta_id,p_versao,p_valor_centavos,p_competencia);
end $$;
revoke all on function financeiro.sso_reconhecer_proposta_com_fechamento(uuid,uuid,uuid,integer,bigint,date) from public,anon,authenticated,service_role;
revoke all on function financeiro.sso_reconhecer_proposta_aceita(uuid,uuid,uuid,integer,bigint,date) from public,anon,authenticated,service_role;
