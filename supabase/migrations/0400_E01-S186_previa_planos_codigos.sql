-- ADR-0174: duas consultas privadas, sem alteração ou migração de registros.
create function pcm.sso_preflight_codigos_entre_clientes(p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_total bigint;
begin
  if not coalesce((select habilitado from pcm.migracao_preflight_gate where id),false) then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or not exists(select 1 from config.usuarios u where u.user_id=auth.uid() and u.ativo and u.papel='superadmin')
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  with codigos as materialized (
    select s.cliente_id,upper(btrim(s.codigo)) as chave from pcm.sistemas s where s.deleted_at is null and s.codigo is not null and btrim(s.codigo)<>''
    union all select e.client_id,upper(btrim(e.identificador)) from pcm.equipamentos e where e.deleted_at is null and e.identificador is not null and btrim(e.identificador)<>''
    union all select a.cliente_id,upper(btrim(a.codigo)) from pcm.sso_codigo_aliases a
      where exists(select 1 from pcm.sistemas s where s.id=a.sistema_id and s.cliente_id=a.cliente_id and s.deleted_at is null)
      or exists(select 1 from pcm.equipamentos e where e.id=a.componente_id and e.client_id=a.cliente_id and e.deleted_at is null)
  )
  select count(distinct proprio.chave) into v_total from codigos proprio
    where proprio.cliente_id=p_cliente_id and exists(select 1 from codigos externo
      where externo.chave=proprio.chave and externo.cliente_id is not null and externo.cliente_id<>p_cliente_id);
  return jsonb_build_object('clienteId',p_cliente_id,'chavesComPossivelCoincidenciaExterna',v_total,
    'comparacao','caixa_e_espacos','incluiSemCliente',false,'exibeDadosExternos',false);
end;
$$;
revoke all on function pcm.sso_preflight_codigos_entre_clientes(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_prever_planos_preventivos_legados(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(plano_id uuid,estado text,alvo_tipo text,alvo_id uuid,ocorrencias bigint,classificacao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.migracao_preflight_gate where id),false) then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or not exists(select 1 from config.usuarios u where u.user_id=auth.uid() and u.ativo and u.papel='superadmin')
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select p.id,p.estado,
    case when p.sistema_id is not null then 'sistema' else 'componente' end::text,
    case when s.cliente_id=p_cliente_id and s.deleted_at is null then s.id
      when e.client_id=p_cliente_id and e.deleted_at is null then e.id else null end,
    (select count(*) from pcm.ocorrencias_preventivas o where o.plano_id=p.id),
    case when (p.sistema_id is not null and (s.id is null or s.deleted_at is not null or s.cliente_id is distinct from p_cliente_id))
      or (p.equipamento_id is not null and (e.id is null or e.deleted_at is not null or e.client_id is distinct from p_cliente_id))
      then 'alvo_requer_revisao' else 'alvo_coerente_migracao_nao_planejada' end::text
    from pcm.planos_preventivos p left join pcm.sistemas s on s.id=p.sistema_id left join pcm.equipamentos e on e.id=p.equipamento_id
    where p.cliente_id=p_cliente_id and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_prever_planos_preventivos_legados(uuid,uuid,integer) from public,anon,authenticated,service_role;
