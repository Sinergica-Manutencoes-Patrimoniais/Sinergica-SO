-- ADR-0979: consulta privada e paginada para os comandos de ciclo posterior.
create function pcm.sso_os_ciclo_posterior(p_cliente_id uuid,p_ciclo_id uuid,p_modo text,p_apos uuid,p_limite integer)
returns table(os_id uuid,numero text,estado_os text,os_atualizada_em timestamptz,chamado_revision bigint,escopo_revision bigint,
  suspensao_revision integer,declaracao_revision integer,declaracao_estado text)
language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo pcm.sso_ciclos_backlog%rowtype;v_chamado pcm.chamados%rowtype;v_escopo pcm.chamado_escopo_composicoes%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate where id and habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_ciclo_id is null or p_modo is null or p_modo not in ('atribuir','interromper')
    or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if p_modo='atribuir' then
    perform 1 from pcm.sso_atribuicao_parcela_gate where id and habilitado for share;
  else
    perform 1 from pcm.sso_interrupcao_parcela_gate where id and habilitado for share;
  end if;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and legado_pendencia_id is null;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_ciclo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=v_chamado.id for share;
  select * into v_ciclo from pcm.sso_ciclos_backlog where id=p_ciclo_id and cliente_id=p_cliente_id and chamado_id=v_chamado.id for share;
  if v_escopo.chamado_id is null or v_ciclo.id is null or v_ciclo.estado<>'em_tratamento' or v_ciclo.legado_pendencia_id is not null
    or not exists(select 1 from pcm.chamado_escopo_parcelas p where p.id=v_ciclo.parcela_id and p.chamado_id=v_chamado.id and p.situacao='pendente')
    or pcm.sso_ciclo_promocao_valida(p_cliente_id,v_ciclo.id,v_chamado.id,v_ciclo.parcela_id) is distinct from true
    then raise exception 'ciclo_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_modo='atribuir' then
    return query select o.id,o.numero,o.status::text,o.updated_at,v_chamado.sso_revisao,v_escopo.revisao,null::integer,0::integer,null::text
      from pcm.ordens_servico o where o.chamado_id=v_chamado.id and o.client_id=p_cliente_id and o.deleted_at is null
      and o.status not in ('finalizado','cancelado') and o.updated_at is not null
      and not exists(select 1 from pcm.sso_atribuicoes_parcela a where a.parcela_id=v_ciclo.parcela_id)
      and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
  else
    return query select o.id,o.numero,o.status::text,o.updated_at,v_chamado.sso_revisao,v_escopo.revisao,s.revisao,
      coalesce(i.revisao,0),i.estado from pcm.sso_atribuicoes_parcela a
      join pcm.ordens_servico o on o.id=a.os_id and o.chamado_id=a.chamado_id and o.client_id=a.cliente_id and o.deleted_at is null
      join pcm.sso_suspensoes_chamado s on s.chamado_id=a.chamado_id and s.cliente_id=a.cliente_id and s.estado='suspenso'
      left join pcm.sso_interrupcoes_parcela i on i.parcela_id=a.parcela_id and i.os_id=a.os_id and i.chamado_id=a.chamado_id and i.cliente_id=a.cliente_id
      where a.parcela_id=v_ciclo.parcela_id and a.chamado_id=v_chamado.id and a.cliente_id=p_cliente_id
        and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
  end if;
end; $$;
revoke all on function pcm.sso_os_ciclo_posterior(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
