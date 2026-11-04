-- ADR-0265: histórico interno limitado ao escopo autorizado.
create function pcm.sso_listar_publicacoes_pendencia(p_cliente_id uuid,p_pendencia_id uuid,p_apos uuid default null)
returns table(id uuid,revisao integer,alvo text,descricao text,estado text,publicado_em timestamptz,revogado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_pendencia_id is null
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.sso_pendencias_tecnicas p where p.id=p_pendencia_id and p.cliente_id=p_cliente_id)
    then raise exception 'pendencia_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.portal_pendencia_gate where pcm.portal_pendencia_gate.id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  return query select pp.id,pp.revisao,pp.alvo,pp.descricao,pp.estado,pp.publicado_em,pp.revogado_em
    from pcm.portal_pendencia_publicacoes pp where pp.pendencia_id=p_pendencia_id and pp.cliente_id=p_cliente_id
      and (p_apos is null or pp.id>p_apos) order by pp.id limit 20;
end $$;
revoke all on function pcm.sso_listar_publicacoes_pendencia(uuid,uuid,uuid) from public,anon,authenticated,service_role;
