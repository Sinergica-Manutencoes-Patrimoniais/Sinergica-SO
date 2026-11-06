-- ADR-0165: somente fatos com origem comprovável, sem alteração de estados.
create function pcm.sso_listar_reconciliacao_comercial(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(proposta_id uuid,os_id uuid,lista_id uuid,status text,versao integer,classificacao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select p.id,os.id,l.id,p.status::text,p.versao_atual,
    case when l.ordem_servico_id is distinct from os.id then 'conflito_de_origem' else 'vinculo_observado' end::text
    from comercial.proposta_origens_operacionais origem
    join comercial.propostas p on p.id=origem.proposta_id and p.deleted_at is null
    left join comercial.oportunidades op on op.id=p.oportunidade_id
    join pcm.ordens_servico os on os.id=origem.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null
    join pcm.listas_materiais l on l.id=origem.lista_materiais_id and l.cliente_id=p_cliente_id
    where (p.oportunidade_id is null or op.cliente_id=p_cliente_id)
      and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_reconciliacao_comercial(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_reconciliacao_financeiro(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(item_id uuid,despesa_id uuid,visita_id uuid,status text,revisao integer,despesa_revisao_atual integer,despesa_revisao_origem integer,classificacao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select f.id,d.id,d.visita_id,f.status,f.revisao,d.revisao,r.despesa_revisao,
    case when f.origem_tipo is distinct from 'despesa_visita' or f.origem_id is distinct from d.id
      or r.visita_id is distinct from d.visita_id then 'conflito_de_origem'
      when r.despesa_revisao is distinct from d.revisao then 'despesa_alterada_conferir' else 'vinculo_observado' end::text
    from financeiro.sso_declaracoes_repasse_despesa r
    join financeiro.itens_faturaveis f on f.id=r.item_id and f.cliente_id=p_cliente_id
    join pcm.despesas_visita d on d.id=r.despesa_id and d.cliente_id=p_cliente_id
    where (p_apos is null or f.id>p_apos) order by f.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_reconciliacao_financeiro(uuid,uuid,integer) from public,anon,authenticated,service_role;
