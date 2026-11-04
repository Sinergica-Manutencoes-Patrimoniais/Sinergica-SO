-- ADR-0932: consulta privada; não conceder execução antes da revisão.
create function pcm.sso_listar_evidencias_onda(
  p_cliente_id uuid, p_onda smallint, p_apos integer, p_revisao integer, p_limite integer
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_habilitado boolean;
  v_revisao integer;
  v_itens jsonb;
begin
  select habilitado into v_habilitado from pcm.sso_evidencias_ondas_gate where id for share;
  if not coalesce(v_habilitado, false) then raise exception 'evidencias_desabilitadas' using errcode = '55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_onda is null or p_onda not between 1 and 6
    or p_limite is null or p_limite not between 1 and 50
    or (p_apos is not null and p_apos < 0) or (p_revisao is not null and p_revisao < 0)
    or (p_apos is not null and p_revisao is null) then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  select revisao into v_revisao from pcm.sso_ondas_homologacao
    where cliente_id = p_cliente_id and onda = p_onda for share;
  v_revisao := coalesce(v_revisao, 0);
  if p_revisao is not null and p_revisao <> v_revisao then raise exception 'fotografia_alterada' using errcode = '40001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'revision', e.revisao, 'cenario', e.cenario, 'versao', e.versao, 'ambiente', e.ambiente,
    'executorId', e.executor_id, 'executadoEm', e.executado_em, 'resultado', e.resultado,
    'identificadores', e.identificadores, 'artefatos', e.artefatos, 'ressalva', e.ressalva
  ) order by e.revisao), '[]'::jsonb) into v_itens
  from (select * from pcm.sso_evidencias_ondas where cliente_id = p_cliente_id and onda = p_onda
    and revisao > coalesce(p_apos, 0) and revisao <= v_revisao order by revisao limit p_limite) e;
  if config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return jsonb_build_object('clienteId', p_cliente_id, 'onda', p_onda, 'revision', v_revisao, 'itens', v_itens);
end;
$$;
revoke all on function pcm.sso_listar_evidencias_onda(uuid,smallint,integer,integer,integer)
  from public, anon, authenticated, service_role;
