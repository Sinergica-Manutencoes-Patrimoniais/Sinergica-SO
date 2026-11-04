-- ADR-0251: publicação explícita e ciência informativa, sem transição operacional.
create table pcm.portal_visita_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.portal_visita_gate(id, habilitado) values(true, false);
alter table pcm.portal_visita_gate enable row level security;
alter table pcm.portal_visita_gate force row level security;
revoke all on pcm.portal_visita_gate from public, anon, authenticated, service_role;

create table pcm.portal_visita_publicacoes (
  id uuid primary key default gen_random_uuid(), cliente_id uuid not null, visita_id uuid not null,
  os_id uuid not null, revisao_visita integer not null, inicio_em timestamptz not null, fim_em timestamptz not null,
  mensagem text not null check(length(btrim(mensagem)) between 1 and 1000),
  publicado_por uuid not null references auth.users(id), publicado_em timestamptz not null default now(),
  revogado_por uuid references auth.users(id), revogado_em timestamptz,
  check((revogado_por is null) = (revogado_em is null)),
  foreign key(visita_id, cliente_id) references pcm.visitas(id, cliente_id),
  foreign key(os_id, cliente_id) references pcm.ordens_servico(id, client_id),
  unique(visita_id, os_id, revisao_visita)
);
create table pcm.portal_visita_ciencias (
  publicacao_id uuid not null references pcm.portal_visita_publicacoes(id),
  contato_id uuid not null references auth.users(id), registrado_em timestamptz not null default now(),
  primary key(publicacao_id, contato_id)
);
alter table pcm.portal_visita_publicacoes enable row level security;
alter table pcm.portal_visita_publicacoes force row level security;
alter table pcm.portal_visita_ciencias enable row level security;
alter table pcm.portal_visita_ciencias force row level security;
revoke all on pcm.portal_visita_publicacoes, pcm.portal_visita_ciencias from public, anon, authenticated, service_role;

create function pcm.sso_portal_publicar_visita(p_visita_id uuid, p_os_id uuid, p_revisao integer, p_mensagem text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v pcm.visitas%rowtype; v_id uuid;
begin
  if not coalesce((select habilitado from pcm.portal_visita_gate where id), false) then raise exception 'portal_visita_indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_visita_id is null or p_os_id is null or p_revisao is null or p_mensagem is null
    or length(btrim(p_mensagem)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  select * into v from pcm.visitas where id=p_visita_id for update;
  if not found or config.sso_autorizar_acao('visita.confirmar', v.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v.revisao <> p_revisao or v.estado not in ('planejada','confirmada','enviada','em_execucao','parcial') then raise exception 'visita_obsoleta' using errcode='40001'; end if;
  perform 1 from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id and o.deleted_at is null
    where vo.visita_id=v.id and vo.os_id=p_os_id and vo.cliente_id=v.cliente_id and vo.encerrado_em is null for share of vo;
  if not found then raise exception 'vinculo_inexistente' using errcode='23514'; end if;
  insert into pcm.portal_visita_publicacoes(cliente_id,visita_id,os_id,revisao_visita,inicio_em,fim_em,mensagem,publicado_por)
    values(v.cliente_id,v.id,p_os_id,v.revisao,v.inicio_em,v.fim_em,btrim(p_mensagem),auth.uid())
    on conflict(visita_id,os_id,revisao_visita) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from pcm.portal_visita_publicacoes where visita_id=v.id and os_id=p_os_id and revisao_visita=v.revisao and mensagem=btrim(p_mensagem) and revogado_em is null;
    if v_id is null then raise exception 'publicacao_conflitante' using errcode='23505'; end if;
  else
    insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'portal.visita_publicada','visitas',v.id,jsonb_build_object('publicacaoId',v_id,'osId',p_os_id,'revisao',v.revisao));
  end if;
  return v_id;
end $$;
revoke all on function pcm.sso_portal_publicar_visita(uuid,uuid,integer,text) from public, anon, authenticated, service_role;

create function pcm.sso_portal_visitas_os(p_cliente_id uuid, p_os_id uuid)
returns table(id uuid,inicio_em timestamptz,fim_em timestamptz,mensagem text,ciente_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not coalesce((select habilitado from pcm.portal_visita_gate where pcm.portal_visita_gate.id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico')
    or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null)
    then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select p.id,p.inicio_em,p.fim_em,p.mensagem,c.registrado_em from pcm.portal_visita_publicacoes p
    join pcm.visitas v on v.id=p.visita_id and v.cliente_id=p.cliente_id and v.revisao=p.revisao_visita and v.estado in ('planejada','confirmada','enviada','em_execucao','parcial')
    join pcm.visita_ordens_servico vo on vo.visita_id=v.id and vo.os_id=p.os_id and vo.cliente_id=p.cliente_id and vo.encerrado_em is null
    left join pcm.portal_visita_ciencias c on c.publicacao_id=p.id and c.contato_id=auth.uid()
    where p.cliente_id=p_cliente_id and p.os_id=p_os_id and p.revogado_em is null order by p.inicio_em,p.id limit 50;
end $$;
revoke all on function pcm.sso_portal_visitas_os(uuid,uuid) from public, anon, authenticated, service_role;

create function pcm.sso_portal_ciente_visita(p_publicacao_id uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_cliente uuid; v_visita uuid; v_revisao integer; v_os uuid; v_em timestamptz;
begin
  if auth.uid() is null or not coalesce((select habilitado from pcm.portal_visita_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select cliente_id,visita_id,revisao_visita,os_id into v_cliente,v_visita,v_revisao,v_os from pcm.portal_visita_publicacoes where id=p_publicacao_id and revogado_em is null for share;
  if not found or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=v_cliente and u.ativo and u.papel='cliente-sindico') then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.visitas v where v.id=v_visita and v.cliente_id=v_cliente and v.revisao=v_revisao and v.estado in ('planejada','confirmada','enviada','em_execucao','parcial') for share;
  if not found then raise exception 'publicacao_obsoleta' using errcode='40001'; end if;
  perform 1 from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id and o.deleted_at is null where vo.visita_id=v_visita and vo.os_id=v_os and vo.cliente_id=v_cliente and vo.encerrado_em is null for share of vo, o;
  if not found then raise exception 'publicacao_obsoleta' using errcode='40001'; end if;
  insert into pcm.portal_visita_ciencias(publicacao_id,contato_id) values(p_publicacao_id,auth.uid()) on conflict do nothing returning registrado_em into v_em;
  if v_em is null then select registrado_em into v_em from pcm.portal_visita_ciencias where publicacao_id=p_publicacao_id and contato_id=auth.uid();
  else insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'portal.visita_ciencia_informativa','visitas',v_visita,jsonb_build_object('publicacaoId',p_publicacao_id,'osId',v_os,'revisao',v_revisao)); end if;
  return v_em;
end $$;
revoke all on function pcm.sso_portal_ciente_visita(uuid) from public, anon, authenticated, service_role;
