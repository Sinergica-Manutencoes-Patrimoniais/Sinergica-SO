-- ADR-0868. Projeção mínima; não altera RLS legada nem abre o gate.
create function pcm.sso_listar_componentes_conversao(p_cliente_id uuid, p_chamado_id uuid, p_apos uuid, p_limite integer)
returns table(id uuid, nome text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from pcm.sso_conversao_integral_mediada_gate g where g.id),false) then
    raise exception 'conversao_integral_mediada_bloqueada' using errcode='55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_conversao_integral_mediada_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.sso_conversao_integral_mediada_gate g where g.id),false) then
    raise exception 'conversao_integral_mediada_bloqueada' using errcode='55000';
  end if;
  if p_limite is null or p_limite not between 1 and 100 then
    raise exception 'consulta_invalida' using errcode='22023';
  end if;
  if auth.uid() is null or p_cliente_id is null or p_chamado_id is null
    or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.chamados c where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null) then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501';
  end if;
  return query select e.id,e.nome from pcm.equipamentos e
    where e.client_id=p_cliente_id and e.deleted_at is null and (p_apos is null or e.id>p_apos)
    order by e.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_componentes_conversao(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_componentes_conversao(uuid,uuid,uuid,integer) to authenticated;
