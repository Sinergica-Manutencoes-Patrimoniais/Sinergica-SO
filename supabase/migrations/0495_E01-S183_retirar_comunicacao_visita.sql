-- ADR-0269: comandos de histórico e retirada dependem dos filtros de 0477 e 0481.
create function pcm.sso_listar_publicacoes_visita(p_cliente_id uuid,p_visita_id uuid,p_os_id uuid,p_apos uuid default null)
returns table(id uuid,revisao integer,mensagem text,publicado_em timestamptz,revogado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null or p_os_id is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.visitas v where v.id=p_visita_id and v.cliente_id=p_cliente_id)
    then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.portal_visita_gate where pcm.portal_visita_gate.id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  return query select p.id,p.revisao_visita,p.mensagem,p.publicado_em,p.revogado_em from pcm.portal_visita_publicacoes p
    where p.cliente_id=p_cliente_id and p.visita_id=p_visita_id and p.os_id=p_os_id and (p_apos is null or p.id>p_apos) order by p.id limit 20;
end $$;
revoke all on function pcm.sso_listar_publicacoes_visita(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_retirar_publicacao_visita(p_publicacao_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare p pcm.portal_visita_publicacoes%rowtype;
begin
  if not coalesce((select habilitado from pcm.portal_visita_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_publicacao_id is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  select * into p from pcm.portal_visita_publicacoes where id=p_publicacao_id for update;
  if not found or config.sso_autorizar_acao('visita.confirmar',p.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p.revogado_em is null then
    update pcm.portal_visita_publicacoes set revogado_em=now(),revogado_por=auth.uid() where id=p.id;
    insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'portal.visita_retirada','visitas',p.visita_id,jsonb_build_object('publicacaoId',p.id,'motivo',btrim(p_motivo)));
  end if;
end $$;
revoke all on function pcm.sso_retirar_publicacao_visita(uuid,text) from public,anon,authenticated,service_role;
