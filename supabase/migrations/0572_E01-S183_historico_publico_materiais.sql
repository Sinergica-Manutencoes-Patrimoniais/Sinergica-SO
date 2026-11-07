-- ADR-0346: versões explicitamente publicadas e não retiradas, sem projeção interna.
create function pcm.sso_portal_historico_materiais(p_cliente_id uuid,p_os_id uuid,p_lista_id uuid,p_apos integer default 0)
returns table(revisao_publicacao integer,publicado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_apos is null or p_apos<0 or not coalesce((select habilitado from pcm.portal_material_visibilidade_gate where id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico')
    or not exists(select 1 from pcm.listas_materiais l join pcm.ordens_servico o on o.id=l.ordem_servico_id and o.client_id=l.cliente_id and o.deleted_at is null
      where l.id=p_lista_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select p.revisao_lista,p.publicado_em from pcm.sso_portal_materiais_publicacoes p
    where p.lista_id=p_lista_id and p.revisao_lista>p_apos
      and coalesce((select e.acao from pcm.portal_material_visibilidade_eventos e where e.lista_id=p.lista_id and e.revisao_publicacao=p.revisao_lista order by e.sequencia desc limit 1),'publicar')<>'retirar'
    order by p.revisao_lista limit 20;
end $$;
revoke all on function pcm.sso_portal_historico_materiais(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_portal_versao_materiais(p_cliente_id uuid,p_os_id uuid,p_lista_id uuid,p_revisao integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_linhas jsonb;
begin
  if auth.uid() is null or p_revisao is null or p_revisao<1 or not coalesce((select habilitado from pcm.portal_material_visibilidade_gate where id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico')
    or not exists(select 1 from pcm.listas_materiais l join pcm.ordens_servico o on o.id=l.ordem_servico_id and o.client_id=l.cliente_id and o.deleted_at is null
      where l.id=p_lista_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select p.linhas into v_linhas from pcm.sso_portal_materiais_publicacoes p where p.lista_id=p_lista_id and p.revisao_lista=p_revisao
    and coalesce((select e.acao from pcm.portal_material_visibilidade_eventos e where e.lista_id=p.lista_id and e.revisao_publicacao=p.revisao_lista order by e.sequencia desc limit 1),'publicar')<>'retirar';
  if v_linhas is null then raise exception 'versao_indisponivel' using errcode='42501'; end if;
  return v_linhas;
end $$;
revoke all on function pcm.sso_portal_versao_materiais(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
