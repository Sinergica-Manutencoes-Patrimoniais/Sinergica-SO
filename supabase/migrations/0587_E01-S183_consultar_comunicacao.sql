-- ADR-0361: consulta individual, sem mutação ou auditoria de leitura presumida.
create function pcm.sso_portal_comunicacao(p_cliente_id uuid,p_tipo text,p_publicacao_id uuid)
returns table(id uuid,tipo text,os_id uuid,publicado_em timestamptz,descricao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_publicacao_id is null or p_tipo is null or p_tipo not in ('visita','pendencia')
    or not coalesce((select habilitado from pcm.portal_comunicacoes_gate where pcm.portal_comunicacoes_gate.id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico') then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_tipo='visita' then
    return query select pub.id,'visita'::text,pub.os_id,pub.publicado_em,pub.mensagem from pcm.portal_visita_publicacoes pub
      join pcm.visitas v on v.id=pub.visita_id and v.cliente_id=pub.cliente_id and v.revisao=pub.revisao_visita and v.estado in ('planejada','confirmada','enviada','em_execucao','parcial')
      join pcm.visita_ordens_servico vo on vo.visita_id=v.id and vo.os_id=pub.os_id and vo.cliente_id=pub.cliente_id and vo.encerrado_em is null
      join pcm.ordens_servico o on o.id=pub.os_id and o.client_id=pub.cliente_id and o.deleted_at is null
      where pub.id=p_publicacao_id and pub.cliente_id=p_cliente_id and pub.revogado_em is null
        and coalesce((select habilitado from pcm.portal_visita_gate where pcm.portal_visita_gate.id),false);
  else
    return query select pub.id,'pendencia'::text,pub.os_id,pub.publicado_em,pub.descricao from pcm.portal_pendencia_publicacoes pub
      join pcm.sso_pendencias_tecnicas p on p.id=pub.pendencia_id and p.cliente_id=pub.cliente_id and p.os_id=pub.os_id and p.revisao=pub.revisao
      join pcm.ordens_servico o on o.id=pub.os_id and o.client_id=pub.cliente_id and o.deleted_at is null
      where pub.id=p_publicacao_id and pub.cliente_id=p_cliente_id and pub.revogado_em is null
        and coalesce((select habilitado from pcm.portal_pendencia_gate where pcm.portal_pendencia_gate.id),false);
  end if;
  if not found then raise exception 'comunicacao_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
end $$;
revoke all on function pcm.sso_portal_comunicacao(uuid,text,uuid) from public,anon,authenticated,service_role;
