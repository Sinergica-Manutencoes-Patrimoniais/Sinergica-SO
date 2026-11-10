-- ADR-0217: evidência manual de intervalo; não altera totais de capacidade.
create table pcm.capacidade_intervalo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.capacidade_intervalo_gate enable row level security;
alter table pcm.capacidade_intervalo_gate force row level security;
revoke all on pcm.capacidade_intervalo_gate from public,anon,authenticated,service_role;
insert into pcm.capacidade_intervalo_gate(id,habilitado) values(true,false);
create table pcm.capacidade_intervalos_declarados (
  id uuid primary key,disponibilidade_id uuid not null references pcm.capacidade_disponibilidades(id),
  revisao_disponibilidade integer not null check(revisao_disponibilidade>0),
  tipo text not null check(tipo in ('ausencia','reserva')),inicio timestamptz not null,fim timestamptz not null,
  fuso text not null,referencia text not null check(length(btrim(referencia)) between 1 and 500),
  request_id uuid not null unique,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  check(isfinite(inicio) and isfinite(fim) and fim>inicio)
);
create index capacidade_intervalos_disponibilidade_idx on pcm.capacidade_intervalos_declarados(disponibilidade_id,inicio,id);
alter table pcm.capacidade_intervalos_declarados enable row level security;
alter table pcm.capacidade_intervalos_declarados force row level security;
revoke all on pcm.capacidade_intervalos_declarados from public,anon,authenticated,service_role;
create function pcm.sso_proteger_intervalo_capacidade() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'intervalo_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_intervalo_capacidade() from public,anon,authenticated,service_role;
create trigger capacidade_intervalo_imutavel before update or delete on pcm.capacidade_intervalos_declarados
  for each row execute function pcm.sso_proteger_intervalo_capacidade();

create function pcm.sso_declarar_intervalo_capacidade(p_request_id uuid,p_intervalo_id uuid,p_disponibilidade_id uuid,
  p_expected_revision integer,p_tipo text,p_inicio timestamptz,p_fim timestamptz,p_fuso text,p_referencia text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_disp pcm.capacidade_disponibilidades%rowtype;v_anterior pcm.capacidade_intervalos_declarados%rowtype;
  v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.capacidade_intervalo_gate where id),false) then raise exception 'intervalos_bloqueados' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_intervalo_id is null or p_disponibilidade_id is null or p_expected_revision is null or p_expected_revision<1
    or p_tipo is null or p_tipo not in ('ausencia','reserva') or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<=p_inicio
    or p_fuso is null or p_fuso<>btrim(p_fuso) or length(p_fuso) not between 1 and 100
    or p_referencia is null or length(btrim(p_referencia)) not between 1 and 500 then raise exception 'intervalo_invalido' using errcode='22023'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_fuso) then raise exception 'fuso_invalido' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capacidade-intervalo:'||p_request_id::text,0));
  select * into v_anterior from pcm.capacidade_intervalos_declarados where request_id=p_request_id;
  select * into v_disp from pcm.capacidade_disponibilidades where id=p_disponibilidade_id for update;
  if not found or config.sso_autorizar_acao('capacidade.gerir',v_disp.cliente_id) is distinct from true then raise exception 'disponibilidade_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if v_anterior.request_id is not null then
    if v_anterior.ator_id is distinct from v_actor or v_anterior.id is distinct from p_intervalo_id or v_anterior.disponibilidade_id is distinct from p_disponibilidade_id
      or v_anterior.revisao_disponibilidade is distinct from p_expected_revision or v_anterior.tipo is distinct from p_tipo or v_anterior.inicio is distinct from p_inicio or v_anterior.fim is distinct from p_fim
      or v_anterior.fuso is distinct from p_fuso or v_anterior.referencia is distinct from btrim(p_referencia) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'intervaloId',p_intervalo_id,'descontadoAutomaticamente',false);
  end if;
  if v_disp.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if (p_inicio at time zone p_fuso)::date<v_disp.semana_inicio or ((p_fim-interval '1 microsecond') at time zone p_fuso)::date>=v_disp.semana_inicio+7 then
    raise exception 'intervalo_fora_da_semana' using errcode='23514'; end if;
  if exists(select 1 from pcm.capacidade_intervalos_declarados i where i.disponibilidade_id=p_disponibilidade_id
    and tstzrange(i.inicio,i.fim,'[)') && tstzrange(p_inicio,p_fim,'[)')) then raise exception 'intervalos_sobrepostos' using errcode='23514'; end if;
  if config.sso_autorizar_acao('capacidade.gerir',v_disp.cliente_id) is distinct from true then raise exception 'disponibilidade_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  insert into pcm.capacidade_intervalos_declarados(id,disponibilidade_id,revisao_disponibilidade,tipo,inicio,fim,fuso,referencia,request_id,ator_id)
    values(p_intervalo_id,p_disponibilidade_id,p_expected_revision,p_tipo,p_inicio,p_fim,p_fuso,btrim(p_referencia),p_request_id,v_actor);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'intervaloId',p_intervalo_id,'descontadoAutomaticamente',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'capacidade.intervalo_declarado','capacidade_disponibilidades',p_disponibilidade_id,
    jsonb_build_object('requestId',p_request_id,'intervaloId',p_intervalo_id,'tipo',p_tipo));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_declarar_intervalo_capacidade(uuid,uuid,uuid,integer,text,timestamptz,timestamptz,text,text)
  from public,anon,authenticated,service_role;

create function pcm.sso_listar_intervalos_capacidade(p_disponibilidade_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,tipo text,inicio timestamptz,fim timestamptz,fuso text,referencia text,revisao_disponibilidade integer)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.capacidade_intervalo_gate where id),false) then raise exception 'intervalos_bloqueados' using errcode='55000'; end if;
  select d.cliente_id into v_cliente from pcm.capacidade_disponibilidades d where d.id=p_disponibilidade_id;
  if auth.uid() is null or v_cliente is null or config.sso_autorizar_acao('capacidade.gerir',v_cliente) is distinct from true then
    raise exception 'disponibilidade_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select i.id,i.tipo,i.inicio,i.fim,i.fuso,i.referencia,i.revisao_disponibilidade
    from pcm.capacidade_intervalos_declarados i where i.disponibilidade_id=p_disponibilidade_id and (p_apos is null or i.id>p_apos)
    order by i.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_intervalos_capacidade(uuid,uuid,integer) from public,anon,authenticated,service_role;
