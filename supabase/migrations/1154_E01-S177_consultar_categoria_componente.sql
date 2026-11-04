-- ADR-1001: consultas privadas; ausência ou divergência não autoriza sincronização.
create function pcm.sso_consultar_categoria_componente(p_ator_id uuid,p_cliente_id uuid,p_componente_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_cliente uuid; v_texto text; v_m pcm.sso_categoria_componente%rowtype; v_ativa boolean;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_componente_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_categoria_componente_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'mapeamento_categoria_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'componente_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select e.client_id,e.categoria into v_cliente,v_texto from pcm.equipamentos e where e.id=p_componente_id and e.deleted_at is null;
  if v_cliente is distinct from p_cliente_id then raise exception 'componente_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_m from pcm.sso_categoria_componente where componente_id=p_componente_id;
  if found and v_m.cliente_id is distinct from p_cliente_id then raise exception 'mapeamento_cliente_divergente' using errcode='23514'; end if;
  select exists(select 1 from pcm.equipamento_categorias c where c.id=v_m.categoria_id and c.deleted_at is null) into v_ativa;
  return pg_catalog.jsonb_build_object('clienteId',p_cliente_id,'componenteId',p_componente_id,'textoAtual',v_texto,'categoriaId',v_m.categoria_id,'revision',coalesce(v_m.revisao,0),
    'atual',v_m.componente_id is not null and v_m.texto_observado is not distinct from v_texto and v_ativa);
end;
$$;
create function pcm.sso_listar_categorias_mapeamento(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,nome text) language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_categoria_componente_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'mapeamento_categoria_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.id,c.nome from pcm.equipamento_categorias c where c.deleted_at is null and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_consultar_categoria_componente(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_listar_categorias_mapeamento(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
