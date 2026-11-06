-- ADR-0255: leitura apenas das comunicações publicadas; não altera Visita.
create function pcm.sso_portal_calendario_visitas(p_cliente_id uuid, p_inicio timestamptz, p_fim timestamptz,
  p_apos_inicio timestamptz default null, p_apos_id uuid default null)
returns table(id uuid, os_id uuid, os_numero text, inicio_em timestamptz, fim_em timestamptz, mensagem text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or not coalesce((select habilitado from pcm.portal_visita_gate where pcm.portal_visita_gate.id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id
      where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico')
    then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim)
    or p_fim <= p_inicio or p_fim - p_inicio > interval '370 days'
    or (p_apos_inicio is null) <> (p_apos_id is null) then raise exception 'periodo_invalido' using errcode='22023'; end if;
  return query select p.id,p.os_id,o.numero::text,p.inicio_em,p.fim_em,p.mensagem from pcm.portal_visita_publicacoes p
    join pcm.visitas v on v.id=p.visita_id and v.cliente_id=p.cliente_id and v.revisao=p.revisao_visita
      and v.estado in ('planejada','confirmada','enviada','em_execucao','parcial')
    join pcm.visita_ordens_servico vo on vo.visita_id=v.id and vo.os_id=p.os_id and vo.cliente_id=p.cliente_id and vo.encerrado_em is null
    join pcm.ordens_servico o on o.id=p.os_id and o.client_id=p.cliente_id and o.deleted_at is null
    where p.cliente_id=p_cliente_id and p.revogado_em is null and p.inicio_em >= p_inicio and p.inicio_em < p_fim
      and (p_apos_inicio is null or (p.inicio_em,p.id) > (p_apos_inicio,p_apos_id))
    order by p.inicio_em,p.id limit 50;
end $$;
revoke all on function pcm.sso_portal_calendario_visitas(uuid,timestamptz,timestamptz,timestamptz,uuid) from public, anon, authenticated, service_role;
