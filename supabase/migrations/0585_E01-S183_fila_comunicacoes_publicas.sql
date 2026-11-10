-- ADR-0359: leitura somente de publicações explícitas; não envia notificações.
create table pcm.portal_comunicacoes_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.portal_comunicacoes_gate(id,habilitado) values(true,false);
alter table pcm.portal_comunicacoes_gate enable row level security;
alter table pcm.portal_comunicacoes_gate force row level security;
revoke all on pcm.portal_comunicacoes_gate from public,anon,authenticated,service_role;
create function pcm.sso_portal_comunicacoes(p_cliente_id uuid,p_apos_data timestamptz default null,p_apos_tipo text default null,p_apos_id uuid default null)
returns table(id uuid,tipo text,os_id uuid,publicado_em timestamptz,descricao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or not coalesce((select habilitado from pcm.portal_comunicacoes_gate where pcm.portal_comunicacoes_gate.id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico') then raise exception 'sem_acesso' using errcode='42501'; end if;
  if (p_apos_data is null)<>(p_apos_tipo is null) or (p_apos_data is null)<>(p_apos_id is null)
    or (p_apos_tipo is not null and p_apos_tipo not in ('visita','pendencia')) then raise exception 'cursor_invalido' using errcode='22023'; end if;
  return query select q.id,q.tipo,q.os_id,q.publicado_em,q.descricao from (
    select pub.id,'visita'::text as tipo,pub.os_id,pub.publicado_em,pub.mensagem as descricao
      from pcm.portal_visita_publicacoes pub
      join pcm.visitas v on v.id=pub.visita_id and v.cliente_id=pub.cliente_id and v.revisao=pub.revisao_visita and v.estado in ('planejada','confirmada','enviada','em_execucao','parcial')
      join pcm.visita_ordens_servico vo on vo.visita_id=v.id and vo.os_id=pub.os_id and vo.cliente_id=pub.cliente_id and vo.encerrado_em is null
      join pcm.ordens_servico o on o.id=pub.os_id and o.client_id=pub.cliente_id and o.deleted_at is null
      where pub.cliente_id=p_cliente_id and pub.revogado_em is null and coalesce((select habilitado from pcm.portal_visita_gate where pcm.portal_visita_gate.id),false)
    union all
    select pub.id,'pendencia'::text,pub.os_id,pub.publicado_em,pub.descricao
      from pcm.portal_pendencia_publicacoes pub join pcm.sso_pendencias_tecnicas p on p.id=pub.pendencia_id and p.cliente_id=pub.cliente_id and p.os_id=pub.os_id and p.revisao=pub.revisao
      join pcm.ordens_servico o on o.id=pub.os_id and o.client_id=pub.cliente_id and o.deleted_at is null
      where pub.cliente_id=p_cliente_id and pub.revogado_em is null and coalesce((select habilitado from pcm.portal_pendencia_gate where pcm.portal_pendencia_gate.id),false)
  ) q where p_apos_data is null or (q.publicado_em,q.tipo,q.id)>(p_apos_data,p_apos_tipo,p_apos_id)
  order by q.publicado_em,q.tipo,q.id limit 20;
end $$;
revoke all on function pcm.sso_portal_comunicacoes(uuid,timestamptz,text,uuid) from public,anon,authenticated,service_role;
