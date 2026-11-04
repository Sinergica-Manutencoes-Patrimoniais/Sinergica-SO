-- ADR-0937: gate existente permanece fechado; sem escrita operacional.
create function pcm.sso_buscar_os_central_materiais(
  p_cliente_id uuid, p_busca text, p_limite integer, p_apos uuid
) returns table(id uuid, numero text, titulo text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 50
    or p_busca is null or length(p_busca) > 80 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_central_materiais_mediada_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.sso_central_materiais_mediada_gate g where g.id), false) then
    raise exception 'central_materiais_bloqueada' using errcode = '55000';
  end if;
  if auth.uid() is null or config.sso_autorizar_acao('material.gerir', p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select o.id, o.numero::text, o.titulo::text
    from pcm.ordens_servico o
    where o.client_id = p_cliente_id and o.deleted_at is null
      and (p_apos is null or o.id > p_apos)
      and (btrim(p_busca) = '' or pg_catalog.strpos(pg_catalog.lower(o.numero::text), pg_catalog.lower(btrim(p_busca))) > 0)
      and exists (select 1 from pcm.listas_materiais l where l.cliente_id = p_cliente_id and l.ordem_servico_id = o.id)
    order by o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_buscar_os_central_materiais(uuid,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_buscar_os_central_materiais(uuid,text,integer,uuid) to authenticated;
