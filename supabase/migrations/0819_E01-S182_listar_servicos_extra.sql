-- ADR-0594: leitura de declarações, não de candidato faturável.
create function financeiro.sso_listar_servicos_extra(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,os_id uuid,proposta_id uuid,versao integer,linha_id uuid,quantidade integer,preco_unitario_centavos text,chave_evento text,justificativa text,ator_id uuid,decisao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from financeiro.sso_servico_extra_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select d.id,d.os_id,d.proposta_id,d.versao,d.linha_id,d.quantidade,d.preco_unitario_centavos::text,d.chave_evento,d.justificativa,d.ator_id,dec.decisao
    from financeiro.sso_servicos_extra_declarados d left join financeiro.sso_servicos_extra_decisoes dec on dec.declaracao_id=d.id
    where d.cliente_id=p_cliente_id and (p_apos is null or d.id>p_apos) order by d.id limit p_limite;
end $$;
revoke all on function financeiro.sso_listar_servicos_extra(uuid,uuid,integer) from public,anon,authenticated,service_role;
