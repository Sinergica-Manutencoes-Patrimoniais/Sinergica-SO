-- ADR-0261: publicações explícitas, dados internos não são projetados.
create table pcm.portal_pendencia_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.portal_pendencia_gate(id,habilitado) values(true,false);
alter table pcm.portal_pendencia_gate enable row level security;
alter table pcm.portal_pendencia_gate force row level security;
revoke all on pcm.portal_pendencia_gate from public,anon,authenticated,service_role;
create table pcm.portal_pendencia_publicacoes(
  id uuid primary key default gen_random_uuid(), pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),
  cliente_id uuid not null references pcm.clientes(id), os_id uuid not null references pcm.ordens_servico(id),
  revisao integer not null, alvo text not null check(length(btrim(alvo)) between 1 and 200),
  descricao text not null check(length(btrim(descricao)) between 1 and 1000), estado text not null,
  publicado_por uuid not null references auth.users(id), publicado_em timestamptz not null default now(),
  revogado_por uuid references auth.users(id), revogado_em timestamptz,
  check((revogado_por is null)=(revogado_em is null)), unique(pendencia_id,revisao)
);
alter table pcm.portal_pendencia_publicacoes enable row level security;
alter table pcm.portal_pendencia_publicacoes force row level security;
revoke all on pcm.portal_pendencia_publicacoes from public,anon,authenticated,service_role;
create function pcm.sso_publicar_pendencia_portal(p_pendencia_id uuid,p_revisao integer,p_alvo text,p_descricao text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p pcm.sso_pendencias_tecnicas%rowtype; v_id uuid;
begin
  if not coalesce((select habilitado from pcm.portal_pendencia_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_pendencia_id is null or p_revisao is null or p_alvo is null or p_descricao is null
    or length(btrim(p_alvo)) not between 1 and 200 or length(btrim(p_descricao)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  select * into p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',p.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p.revisao<>p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from pcm.ordens_servico o where o.id=p.os_id and o.client_id=p.cliente_id and o.deleted_at is null) then raise exception 'os_indisponivel' using errcode='23514'; end if;
  insert into pcm.portal_pendencia_publicacoes(pendencia_id,cliente_id,os_id,revisao,alvo,descricao,estado,publicado_por)
    values(p.id,p.cliente_id,p.os_id,p.revisao,btrim(p_alvo),btrim(p_descricao),p.estado,auth.uid())
    on conflict(pendencia_id,revisao) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from pcm.portal_pendencia_publicacoes where pendencia_id=p.id and revisao=p.revisao and alvo=btrim(p_alvo) and descricao=btrim(p_descricao) and revogado_em is null;
    if v_id is null then raise exception 'publicacao_conflitante' using errcode='23505'; end if;
  else insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'portal.pendencia_publicada','pendencias_tecnicas',p.id,jsonb_build_object('publicacaoId',v_id,'revisao',p.revisao)); end if;
  return v_id;
end $$;
revoke all on function pcm.sso_publicar_pendencia_portal(uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_revogar_pendencia_portal(p_publicacao_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare p pcm.portal_pendencia_publicacoes%rowtype;
begin
  if not coalesce((select habilitado from pcm.portal_pendencia_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_publicacao_id is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  select * into p from pcm.portal_pendencia_publicacoes where id=p_publicacao_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',p.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p.revogado_em is null then
    update pcm.portal_pendencia_publicacoes set revogado_em=now(),revogado_por=auth.uid() where id=p.id;
    insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'portal.pendencia_revogada','pendencias_tecnicas',p.pendencia_id,jsonb_build_object('publicacaoId',p.id,'motivo',btrim(p_motivo)));
  end if;
end $$;
revoke all on function pcm.sso_revogar_pendencia_portal(uuid,text) from public,anon,authenticated,service_role;
create function pcm.sso_portal_pendencias_os(p_cliente_id uuid,p_os_id uuid,p_apos uuid default null)
returns table(id uuid,alvo text,descricao text,estado text,publicado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not coalesce((select habilitado from pcm.portal_pendencia_gate where pcm.portal_pendencia_gate.id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico')
    or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select pp.id,pp.alvo,pp.descricao,pp.estado,pp.publicado_em from pcm.portal_pendencia_publicacoes pp
    join pcm.sso_pendencias_tecnicas p on p.id=pp.pendencia_id and p.cliente_id=pp.cliente_id and p.os_id=pp.os_id and p.revisao=pp.revisao
    where pp.cliente_id=p_cliente_id and pp.os_id=p_os_id and pp.revogado_em is null and (p_apos is null or pp.id>p_apos) order by pp.id limit 20;
end $$;
revoke all on function pcm.sso_portal_pendencias_os(uuid,uuid,uuid) from public,anon,authenticated,service_role;
