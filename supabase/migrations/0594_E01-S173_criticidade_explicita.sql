-- ADR-0368: registro explícito; não infere escala ou prioridade.
create table pcm.sso_criticidade_pendencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_criticidade_pendencia_gate(id,habilitado) values(true,false);
create table pcm.sso_criticidade_pendencia(id uuid primary key default gen_random_uuid(),pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),revisao integer not null check(revisao>0),criticidade text check(criticidade is null or length(btrim(criticidade)) between 1 and 100),motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),unique(pendencia_id,revisao));
alter table pcm.sso_criticidade_pendencia_gate enable row level security;alter table pcm.sso_criticidade_pendencia_gate force row level security;
alter table pcm.sso_criticidade_pendencia enable row level security;alter table pcm.sso_criticidade_pendencia force row level security;
revoke all on pcm.sso_criticidade_pendencia_gate,pcm.sso_criticidade_pendencia from public,anon,authenticated,service_role;
create function pcm.sso_criticidade_pendencia_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_criticidade_pendencia_imutavel() from public,anon,authenticated,service_role;
create trigger sso_criticidade_pendencia_imutavel before update or delete on pcm.sso_criticidade_pendencia for each row execute function pcm.sso_criticidade_pendencia_imutavel();
create function pcm.sso_atribuir_criticidade_pendencia(p_request_id uuid,p_pendencia_id uuid,p_revision integer,p_criticidade text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_p pcm.sso_pendencias_tecnicas%rowtype;v_ant pcm.sso_criticidade_pendencia%rowtype;v_criticidade text:=nullif(btrim(p_criticidade),'');
begin
  if not coalesce((select habilitado from pcm.sso_criticidade_pendencia_gate where id),false) then raise exception 'criticidade_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_pendencia_id is null or p_revision is null or p_revision<1 or (v_criticidade is not null and length(v_criticidade)>100) or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('criticidade-pendencia:'||p_request_id::text,0));
  select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_criticidade_pendencia where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.pendencia_id is distinct from p_pendencia_id or v_ant.revisao<>p_revision+1 or v_ant.criticidade is distinct from v_criticidade or v_ant.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('pendenciaId',p_pendencia_id,'revision',v_ant.revisao,'criticidade',v_ant.criticidade,'requestId',p_request_id);
  end if;
  if v_p.revisao<>p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  update pcm.sso_pendencias_tecnicas set revisao=revisao+1 where id=p_pendencia_id returning * into v_p;
  insert into pcm.sso_criticidade_pendencia(pendencia_id,revisao,criticidade,motivo,ator_id,request_id) values(v_p.id,v_p.revisao,v_criticidade,btrim(p_motivo),v_ator,p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'pendencia.criticidade_declarada','pendencia_tecnica',v_p.id,jsonb_build_object('clienteId',v_p.cliente_id,'revision',v_p.revisao,'criticidade',v_criticidade,'motivo',btrim(p_motivo),'requestId',p_request_id));
  return jsonb_build_object('pendenciaId',v_p.id,'revision',v_p.revisao,'criticidade',v_criticidade,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_atribuir_criticidade_pendencia(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_criticidade_pendencias_alvo(p_cliente_id uuid,p_tipo text,p_alvo_id uuid)
returns table(criticidade text,quantidade bigint) language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.sso_criticidade_pendencia_gate where id),false) then raise exception 'criticidade_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_tipo is null or p_tipo not in ('sistema','componente','grupo') or p_alvo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.criticidade,count(*) from pcm.sso_pendencias_tecnicas p left join lateral (select x.criticidade from pcm.sso_criticidade_pendencia x where x.pendencia_id=p.id order by x.revisao desc limit 1) c on true where p.cliente_id=p_cliente_id and p.alvo_tipo=p_tipo and p.alvo_id=p_alvo_id and p.estado='aberta' group by c.criticidade order by c.criticidade nulls first limit 101;
end;
$$;
revoke all on function pcm.sso_criticidade_pendencias_alvo(uuid,text,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_listar_criticidade_pendencia(p_pendencia_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,criticidade text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_criticidade_pendencia_gate where id),false) then raise exception 'criticidade_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_pendencia_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select p.cliente_id into v_cliente from pcm.sso_pendencias_tecnicas p where p.id=p_pendencia_id;
  if v_cliente is null or config.sso_autorizar_acao('execucao.validar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.revisao,c.criticidade,c.motivo,c.ator_id,c.criado_em from pcm.sso_criticidade_pendencia c where c.pendencia_id=p_pendencia_id and (p_apos is null or c.revisao>p_apos) order by c.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_criticidade_pendencia(uuid,integer,integer) from public,anon,authenticated,service_role;
