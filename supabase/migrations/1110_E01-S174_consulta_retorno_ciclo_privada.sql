-- ADR-0961: consulta privada, sem EXECUTE operacional e sem ranking oficial.
create function pcm.sso_listar_retornos_ciclo(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,ciclo_id uuid,pendencia_id uuid,composicao_id uuid,chamado_id uuid,parcela_id uuid,os_id uuid,
  reconciliacao_id uuid,estado text,revisao integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform 1 from pcm.sso_retorno_ciclo_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'retorno_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_ciclos_backlog_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'ciclos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select r.id,r.ciclo_id,r.pendencia_id,c.composicao_id,r.chamado_id,r.parcela_id,r.os_id,r.reconciliacao_id,r.estado,r.revisao,r.criado_em
    from pcm.sso_retornos_ciclo_backlog r join pcm.sso_ciclos_backlog c on c.id=r.ciclo_id and c.cliente_id=r.cliente_id and c.pendencia_id=r.pendencia_id
    where r.cliente_id=p_cliente_id and (p_apos is null or r.id>p_apos) order by r.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_retornos_ciclo(uuid,uuid,integer) from public,anon,authenticated,service_role;
