-- ADR-1017: consulta privada, sem alterar ou classificar fontes.
create table comercial.sso_consulta_parcelas_orcamento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_consulta_parcelas_orcamento_gate(id,habilitado) values(true,false);
alter table comercial.sso_consulta_parcelas_orcamento_gate enable row level security;
alter table comercial.sso_consulta_parcelas_orcamento_gate force row level security;
revoke all on comercial.sso_consulta_parcelas_orcamento_gate from public,anon,authenticated,service_role;
create function comercial.sso_listar_parcelas_orcamento(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_apos_despesa uuid,p_apos_vinculo uuid,p_limite integer)
returns table(despesa_id uuid,despesa_revision integer,rateio_revision integer,vinculo_id uuid,descricao text,valor_centavos bigint,base text)
language plpgsql volatile security definer set search_path='' as $$
declare v_lista pcm.listas_materiais%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_lista_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos_despesa is null)<>(p_apos_vinculo is null) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from comercial.sso_consulta_parcelas_orcamento_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'consulta_parcelas_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_lista from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id and responsavel='sinergica';
  if not found or not exists(select 1 from pcm.ordens_servico os where os.id=v_lista.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null) then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return query select d.id,d.revisao,p.revisao,p.vinculo_id,d.descricao,p.valor_centavos,case when d.realizado_centavos is null then 'previsto' else 'realizado' end
    from pcm.despesas_visita d join pcm.despesa_visita_rateio_parcelas p on p.despesa_id=d.id
    join pcm.visita_ordens_servico vo on vo.id=p.vinculo_id and vo.cliente_id=d.cliente_id and vo.visita_id=d.visita_id and vo.os_id=v_lista.ordem_servico_id
    where d.cliente_id=p_cliente_id and d.status='ativa' and p.revisao=(select max(r.revisao) from pcm.despesa_visita_rateios r where r.despesa_id=d.id)
      and (p_apos_despesa is null or (d.id,p.vinculo_id)>(p_apos_despesa,p_apos_vinculo))
    order by d.id,p.vinculo_id limit p_limite;
end;
$$;
revoke all on function comercial.sso_listar_parcelas_orcamento(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
