-- ADR-0362: confirmação explícita separada da ciência, sem efeito de envio.
create table pcm.portal_confirmacao_cliente_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.portal_confirmacao_cliente_gate(id,habilitado) values(true,false);
alter table pcm.portal_confirmacao_cliente_gate enable row level security;
alter table pcm.portal_confirmacao_cliente_gate force row level security;
revoke all on pcm.portal_confirmacao_cliente_gate from public,anon,authenticated,service_role;
create table pcm.portal_confirmacoes_cliente(
  confirmacao_pcm_id uuid primary key references pcm.visita_confirmacoes(id),publicacao_id uuid not null references pcm.portal_visita_publicacoes(id),
  contato_id uuid not null references auth.users(id),request_id uuid not null unique,confirmado_em timestamptz not null default now()
);
alter table pcm.portal_confirmacoes_cliente enable row level security;
alter table pcm.portal_confirmacoes_cliente force row level security;
revoke all on pcm.portal_confirmacoes_cliente from public,anon,authenticated,service_role;
create function pcm.sso_portal_confirmar_visita(p_request_id uuid,p_publicacao_id uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare pub pcm.portal_visita_publicacoes%rowtype; v pcm.visitas%rowtype; c pcm.visita_confirmacoes%rowtype;
  anterior pcm.portal_confirmacoes_cliente%rowtype; pol record; v_quando timestamptz; v_contrato uuid;
begin
  if auth.uid() is null or p_request_id is null or p_publicacao_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from pcm.portal_confirmacao_cliente_gate where id),false)
    or not coalesce((select habilitado from pcm.portal_visita_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  select * into pub from pcm.portal_visita_publicacoes where id=p_publicacao_id;
  if not found or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id
    where uc.user_id=auth.uid() and uc.cliente_id=pub.cliente_id and u.ativo and u.papel='cliente-sindico') then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-confirmacao:'||p_request_id::text,0));
  select * into anterior from pcm.portal_confirmacoes_cliente where request_id=p_request_id;
  if found then
    if anterior.contato_id is distinct from auth.uid() or anterior.publicacao_id<>p_publicacao_id then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return anterior.confirmado_em;
  end if;
  select * into v from pcm.visitas where id=pub.visita_id and cliente_id=pub.cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_contrato:=v.contrato_id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:'||v.cliente_id::text||':-:-',0));
  if v.contrato_id is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:'||v.cliente_id::text||':'||v.contrato_id::text||':-',0)); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:'||v.cliente_id::text||':-:'||v.id::text,0));
  select * into v from pcm.visitas where id=pub.visita_id and cliente_id=pub.cliente_id for update;
  if not found or v.contrato_id is distinct from v_contrato or v.revisao<>pub.revisao_visita or v.estado<>'confirmada' then raise exception 'visita_obsoleta' using errcode='40001'; end if;
  select * into pub from pcm.portal_visita_publicacoes where id=p_publicacao_id and revogado_em is null for share;
  if not found then raise exception 'publicacao_indisponivel' using errcode='42501'; end if;
  perform 1 from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id and o.deleted_at is null
    where vo.visita_id=v.id and vo.os_id=pub.os_id and vo.cliente_id=v.cliente_id and vo.encerrado_em is null for share of vo,o;
  if not found then raise exception 'vinculo_indisponivel' using errcode='40001'; end if;
  select * into c from pcm.visita_confirmacoes where visita_id=v.id and cliente_id=v.cliente_id and revisao=v.revisao;
  select coalesce(p.modo,'sem_controle') as modo,
    case when p.visita_id is not null then 'visita' when p.contrato_id is not null then 'contrato' when p.id is not null then 'cliente' else 'padrao' end as origem,
    p.id as politica_id,p.revisao as politica_revisao into pol
    from (select 1) base left join lateral(select x.* from pcm.politicas_ciencia_visita x where x.cliente_id=v.cliente_id
      and (x.visita_id=v.id or (x.visita_id is null and x.contrato_id=v.contrato_id and v.contrato_id is not null) or (x.visita_id is null and x.contrato_id is null))
      order by case when x.visita_id is not null then 1 when x.contrato_id is not null then 2 else 3 end limit 1) p on true;
  if c.id is null or c.politica_modo<>'obrigatoria' or pol.modo is distinct from c.politica_modo or pol.origem is distinct from c.politica_origem
    or pol.politica_id is distinct from c.politica_id or pol.politica_revisao is distinct from c.politica_revisao then raise exception 'politica_ou_confirmacao_obsoleta' using errcode='40001'; end if;
  insert into pcm.portal_confirmacoes_cliente(confirmacao_pcm_id,publicacao_id,contato_id,request_id) values(c.id,pub.id,auth.uid(),p_request_id)
    on conflict(confirmacao_pcm_id) do nothing returning confirmado_em into v_quando;
  if v_quando is null then raise exception 'confirmacao_cliente_ja_registrada' using errcode='23505'; end if;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'visita.confirmacao_cliente_portal','visitas',v.id,
    jsonb_build_object('requestId',p_request_id,'clienteId',v.cliente_id,'confirmacaoPcmId',c.id,'publicacaoId',pub.id,'revisao',v.revisao));
  return v_quando;
end $$;
revoke all on function pcm.sso_portal_confirmar_visita(uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_portal_status_confirmacao_visita(p_publicacao_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare pub pcm.portal_visita_publicacoes%rowtype; v pcm.visitas%rowtype; c pcm.visita_confirmacoes%rowtype; pol record;
begin
  if auth.uid() is null or not coalesce((select habilitado from pcm.portal_confirmacao_cliente_gate where id),false)
    or not coalesce((select habilitado from pcm.portal_visita_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into pub from pcm.portal_visita_publicacoes where id=p_publicacao_id and revogado_em is null;
  if not found or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=auth.uid() and uc.cliente_id=pub.cliente_id and u.ativo and u.papel='cliente-sindico') then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v from pcm.visitas where id=pub.visita_id and cliente_id=pub.cliente_id;
  if not found or v.revisao<>pub.revisao_visita or v.estado<>'confirmada'
    or not exists(select 1 from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id and o.deleted_at is null where vo.visita_id=v.id and vo.os_id=pub.os_id and vo.cliente_id=v.cliente_id and vo.encerrado_em is null)
    then return 'desatualizada'; end if;
  select * into c from pcm.visita_confirmacoes where visita_id=v.id and cliente_id=v.cliente_id and revisao=v.revisao;
  select coalesce(p.modo,'sem_controle') as modo,
    case when p.visita_id is not null then 'visita' when p.contrato_id is not null then 'contrato' when p.id is not null then 'cliente' else 'padrao' end as origem,
    p.id as politica_id,p.revisao as politica_revisao into pol
    from (select 1) base left join lateral(select x.* from pcm.politicas_ciencia_visita x where x.cliente_id=v.cliente_id
      and (x.visita_id=v.id or (x.visita_id is null and x.contrato_id=v.contrato_id and v.contrato_id is not null) or (x.visita_id is null and x.contrato_id is null))
      order by case when x.visita_id is not null then 1 when x.contrato_id is not null then 2 else 3 end limit 1) p on true;
  if c.id is null or pol.modo is distinct from c.politica_modo or pol.origem is distinct from c.politica_origem
    or pol.politica_id is distinct from c.politica_id or pol.politica_revisao is distinct from c.politica_revisao then return 'desatualizada'; end if;
  if c.politica_modo<>'obrigatoria' then return 'nao_exigida'; end if;
  if exists(select 1 from pcm.portal_confirmacoes_cliente x where x.confirmacao_pcm_id=c.id) then return 'confirmada'; end if;
  return 'pendente';
end $$;
revoke all on function pcm.sso_portal_status_confirmacao_visita(uuid) from public,anon,authenticated,service_role;
