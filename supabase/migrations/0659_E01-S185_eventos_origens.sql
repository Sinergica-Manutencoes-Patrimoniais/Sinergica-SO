-- ADR-0433: projeções mínimas de eventos existentes; sem ações externas.
create function pcm.sso_eventos_reconciliacao_comercial(p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_sequencia integer,p_limite integer)
returns table(versao integer,sequencia integer,acao text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_proposta_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or not exists(
      select 1 from comercial.proposta_origens_operacionais origem join comercial.propostas p on p.id=origem.proposta_id and p.deleted_at is null
      left join comercial.oportunidades op on op.id=p.oportunidade_id join pcm.ordens_servico o on o.id=origem.ordem_servico_id and o.client_id=p_cliente_id and o.deleted_at is null
      where p.id=p_proposta_id and (p.oportunidade_id is null or op.cliente_id=p_cliente_id)) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or ((p_versao is null)<>(p_sequencia is null)) or p_versao<1 or p_sequencia<1 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select e.versao,e.sequencia,e.acao,e.criado_em from comercial.sso_visibilidade_orcamento_eventos e where e.proposta_id=p_proposta_id
    and (p_versao is null or (e.versao,e.sequencia)>(p_versao,p_sequencia)) order by e.versao,e.sequencia limit p_limite;
end $$;
revoke all on function pcm.sso_eventos_reconciliacao_comercial(uuid,uuid,integer,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_eventos_reconciliacao_financeiro(p_cliente_id uuid,p_item_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,tipo text,ocorrido_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true
    or not exists(select 1 from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or p_apos<0 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select e.revisao,e.tipo,e.ocorrido_em from financeiro.sso_faturavel_eventos e where e.item_id=p_item_id and (p_apos is null or e.revisao>p_apos) order by e.revisao limit p_limite;
end $$;
revoke all on function pcm.sso_eventos_reconciliacao_financeiro(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
