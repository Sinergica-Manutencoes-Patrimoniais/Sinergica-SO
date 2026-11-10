-- ADR-1288: leitura restrita dos recibos de conflito, sem reprocessamento.
create function pcm.sso_listar_conflitos_campo(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos uuid,p_limite integer)
returns table(envelope_id uuid,estado text,registrado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_consulta_estado_campo_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from pcm.sso_origem_campo_processamentos p join pcm.ordens_servico o on o.id=p.os_id and o.client_id=p.cliente_id and o.deleted_at is null where p.cliente_id=p_cliente_id and p.os_id=p_os_id) then raise exception 'origem_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return query select d.envelope_id,d.estado,d.criado_em from pcm.sso_origem_campo_entregas d
    join pcm.sso_origem_campo_processamentos p on p.integracao=d.integracao and p.task_id=d.task_id and p.os_id=d.os_id
    where p.cliente_id=p_cliente_id and p.os_id=p_os_id and d.estado in ('conflito_regressao','conflito_ordem')
      and (p_apos is null or d.envelope_id>p_apos) order by d.envelope_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_conflitos_campo(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_conflitos_campo(uuid,uuid,uuid,uuid,integer) to authenticated;
