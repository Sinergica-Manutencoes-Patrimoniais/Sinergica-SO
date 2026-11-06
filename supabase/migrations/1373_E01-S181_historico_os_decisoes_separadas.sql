-- ADR-1218: orçamento e decisões paginados separadamente; sem expor valores.
create function comercial.sso_exigir_historico_legado_os(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from comercial.sso_historico_legado_operacional_gate where id and habilitado for share;
  if not found then raise exception 'indisponivel' using errcode='55000'; end if;
  if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function comercial.sso_exigir_historico_legado_os(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function comercial.sso_historico_legado_os_paginado(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos uuid,p_limite integer)
returns table(orcamento_id uuid,numero text,status text,valido_ate date,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform comercial.sso_exigir_historico_legado_os(p_ator_id,p_cliente_id,p_os_id);
  return query select o.id,o.numero,o.status,o.valido_ate,o.created_at from pcm.orcamentos_servico o
    where o.cliente_id=p_cliente_id and o.ordem_servico_id=p_os_id and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end; $$;
revoke all on function comercial.sso_historico_legado_os_paginado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_historico_legado_os_paginado(uuid,uuid,uuid,uuid,integer) to authenticated;

create function comercial.sso_decisoes_legado_os_paginadas(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_orcamento_id uuid,p_apos uuid,p_limite integer)
returns table(decisao_id uuid,decisao text,decisao_em timestamptz,decisao_autor uuid)
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_orcamento_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform comercial.sso_exigir_historico_legado_os(p_ator_id,p_cliente_id,p_os_id);
  perform 1 from pcm.orcamentos_servico where id=p_orcamento_id and cliente_id=p_cliente_id and ordem_servico_id=p_os_id for share;
  if not found then raise exception 'orcamento_indisponivel' using errcode='42501'; end if;
  return query select d.id,d.decisao,d.created_at,d.autor_user_id from pcm.orcamento_decisoes d
    where d.orcamento_id=p_orcamento_id and d.cliente_id=p_cliente_id and (p_apos is null or d.id>p_apos) order by d.id limit p_limite;
end; $$;
revoke all on function comercial.sso_decisoes_legado_os_paginadas(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_decisoes_legado_os_paginadas(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
