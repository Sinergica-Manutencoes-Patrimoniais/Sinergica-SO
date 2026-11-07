-- ADR-0349: descoberta limitada a listas com versões anteriores ainda publicadas.
create function pcm.sso_portal_listas_historico_materiais(p_cliente_id uuid,p_os_id uuid,p_apos uuid default null)
returns table(lista_id uuid) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not coalesce((select habilitado from pcm.portal_material_visibilidade_gate where id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico')
    or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null)
    then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select l.id from pcm.listas_materiais l where l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id and (p_apos is null or l.id>p_apos)
    and exists(select 1 from pcm.sso_portal_materiais_publicacoes pub where pub.lista_id=l.id
      and pub.revisao_lista<(select max(ultima.revisao_lista) from pcm.sso_portal_materiais_publicacoes ultima where ultima.lista_id=l.id)
      and coalesce((select e.acao from pcm.portal_material_visibilidade_eventos e where e.lista_id=pub.lista_id and e.revisao_publicacao=pub.revisao_lista order by e.sequencia desc limit 1),'publicar')<>'retirar')
    order by l.id limit 20;
end $$;
revoke all on function pcm.sso_portal_listas_historico_materiais(uuid,uuid,uuid) from public,anon,authenticated,service_role;
