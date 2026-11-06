-- ADR-1659: consulta aditiva; preserva RLS e gate fechado de 1794.
create function pcm.sso_local_ativo_preventivas_legadas(
  p_ator uuid,p_cliente uuid,p_local uuid,p_ativo uuid,p_apos uuid,p_limite integer
) returns table(id uuid,nome text,estado text,primeira_data date,intervalo_n integer,intervalo_unidade text)
language plpgsql volatile security invoker set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_local is null or p_ativo is null
    or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if not pcm.sso_local_ativo_leitura_habilitada() then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.ler',p_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is not true then
    raise exception 'ativo_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return query select p.id,p.nome,p.estado,p.primeira_data,p.intervalo_n,p.intervalo_unidade
    from pcm.planos_preventivos p
    join pcm.equipamentos e on e.id=p.equipamento_id and e.id=p_ativo and e.client_id=p_cliente and e.local_id=p_local and e.deleted_at is null
    join pcm.locais l on l.id=e.local_id and l.deleted_at is null
    join pcm.areas a on a.id=l.area_id and a.cliente_id=p_cliente and a.deleted_at is null
    where p.cliente_id=p_cliente and (p_apos is null or p.id>p_apos)
      and (config.sso_autorizar_acao('cadastro.ler',p_cliente) is true or config.sso_autorizar_acao('cadastro.gerir',p_cliente) is true)
    order by p.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_local_ativo_preventivas_legadas(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_local_ativo_preventivas_legadas(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
