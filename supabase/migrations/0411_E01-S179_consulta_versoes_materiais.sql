-- ADR-0185: consultas preparadas, sem concessão operacional.
create function pcm.sso_obter_linhas_materiais_vigentes(p_lista_id uuid,p_revisao integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_linhas jsonb;
begin
  select * into v_lista from pcm.listas_materiais where id=p_lista_id;
  if not found or config.sso_autorizar_acao('material.gerir',v_lista.cliente_id) is not true or not exists(select 1 from pcm.ordens_servico o where o.id=v_lista.ordem_servico_id and o.client_id=v_lista.cliente_id and o.deleted_at is null) then raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if p_revisao is null or p_revisao<1 or p_revisao>v_lista.revisao then raise exception 'revisao_invalida' using errcode='22023'; end if;
  select v.linhas into v_linhas from pcm.sso_lista_materiais_versoes v where v.lista_id=p_lista_id and v.revisao<=p_revisao order by v.revisao desc limit 1;
  return v_linhas;
end;
$$;
revoke all on function pcm.sso_obter_linhas_materiais_vigentes(uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_versoes_materiais(p_lista_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,criado_por uuid,criado_em timestamptz) language plpgsql stable security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype;
begin
  if p_lista_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_lista from pcm.listas_materiais where id=p_lista_id;
  if not found or config.sso_autorizar_acao('material.gerir',v_lista.cliente_id) is not true or not exists(select 1 from pcm.ordens_servico o where o.id=v_lista.ordem_servico_id and o.client_id=v_lista.cliente_id and o.deleted_at is null) then raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  return query select v.revisao,v.criado_por,v.criado_em from pcm.sso_lista_materiais_versoes v where v.lista_id=p_lista_id and (p_apos is null or v.revisao<p_apos) order by v.revisao desc limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_versoes_materiais(uuid,integer,integer) from public,anon,authenticated,service_role;
